import { fmtDate } from "../format";
import type { ExtractedBill, LineItem } from "../types";

/**
 * Rule-based parser for TNB e-bill text (as produced by unpdf). Used when no Claude API key
 * is configured. Layout-specific: if TNB changes its bill design this will throw, and the
 * Claude extractor is the fallback.
 */

const MALAY_MONTHS: Record<string, string> = {
  JAN: "01", FEB: "02", MAC: "03", APR: "04", MEI: "05", JUN: "06",
  JUL: "07", OGO: "08", SEP: "09", OKT: "10", NOV: "11", DIS: "12",
};

const num = (s: string) => Number(s.replace(/,/g, ""));
const dmy = (s: string) => {
  const [d, m, y] = s.split(/[./]/);
  return `${y.length === 2 ? "20" + y : y}-${m}-${d}`;
};

function after(text: string, label: RegExp): string | null {
  const m = text.match(new RegExp(label.source + String.raw`\s*\n\s*([^\n]+)`, "i"));
  return m ? m[1].trim() : null;
}

function must<T>(v: T | null | undefined, what: string): T {
  if (v == null) throw new Error(`TNB parser: could not find ${what}`);
  return v;
}

export function looksLikeTnbBill(text: string): boolean {
  return /Bil Elektrik Anda/i.test(text) && /TNB/i.test(text);
}

export function parseTnbText(text: string): ExtractedBill {
  const accountNo = must(after(text, /NO\. AKAUN/), "account number");
  const billDate = dmy(must(after(text, /TARIKH BIL/), "bill date"));
  const period = text.match(/TEMPOH BIL\s*\n\s*(\d{2}\.\d{2}\.\d{4})\s*-\s*(\d{2}\.\d{2}\.\d{4})/i);
  const kwh = text.match(/Jumlah Penggunaan Anda kWh\s+[\d.,]+\s+[\d.,]+\s+([\d.,]+)/i);
  const current = must(text.match(/\nCaj Semasa RM\s+([\d.,]+)/i)?.[1], "current charges");
  const due = text.match(/Sila bayar sebelum\s*\n\s*(\d{2}) (\w{3}) (\d{4})/i);

  const lineItems: LineItem[] = [];
  const start = text.search(/Pecahan Pengiraan Bil Anda/i);
  const breakdown = start >= 0 ? text.slice(start, text.indexOf("\nCaj Semasa RM", start)) : "";
  const lineRe = /^(.+?)[ \t]+RM[ \t]+(-?[\d.,]+)(?:[ \t]+(-?[\d.,]+)[ \t]+(-?[\d.,]+))?[ \t]*$/gm;
  for (const m of breakdown.matchAll(lineRe)) {
    const label = m[1].trim();
    if (/^(Caj Semasa|Caj Penggunaan Bulan Semasa)/i.test(label)) continue;
    const amount = num(m[4] ?? m[2]);
    const rate = label.match(/RM(-?[\d.]+)\/kWh/i);
    const qty = label.match(/\((\d+)kWh/i);
    lineItems.push({
      label: translateCharge(label),
      amount,
      quantity: qty ? Number(qty[1]) : null,
      unit: rate ? "kWh" : null,
      rate: rate ? Number(rate[1]) : null,
    });
  }

  const afa = [...text.matchAll(/AFA \(\d+kWh, RM([\d.]+)\/kWh\) mulai \d{2}\/(\d{2})\/(\d{2})/gi)].map((m) => ({
    month: `20${m[3]}-${m[2]}`,
    rate: Number(m[1]),
  }));

  // 6-month chart: labels like "Apr-26 Mei-26 ..." followed by a line of kWh values; the
  // RM amounts appear earlier as "(BS) RM200.15" in the same order.
  const history: ExtractedBill["history"] = [];
  const labels = text.match(/^((?:[A-Za-z]{3}-\d{2}\s*){2,})\n([\d\s]+)$/m);
  if (labels) {
    const months = labels[1].trim().split(/\s+/).map((l) => {
      const [mon, yy] = l.split("-");
      return `20${yy}-${MALAY_MONTHS[mon.toUpperCase()]}`;
    });
    const usages = labels[2].trim().split(/\s+/).map(Number);
    const amounts = [...text.matchAll(/\((?:BS|AN|BA|BP)\) RM([\d.,]+)/g)].map((m) => num(m[1]));
    months.forEach((month, i) => history.push({ month, usage: usages[i] ?? null, amount: amounts[i] ?? null }));
  }

  const payBy = text.match(/Jelaskan tunggakan anda sebelum (\d{2}\.\d{2}\.\d{4})/i);
  const cut = text.match(/Pemotongan bekalan elektrik akan dilakukan mulai (\d{2}\.\d{2}\.\d{4}) hingga\s+(\d{2}\.\d{2}\.\d{4})/i);
  const arrears = text.match(/Tunggakan Perlu Bayar RM\s*\n\s*([\d.,]+)/i);

  const notices: string[] = [];
  if (payBy && cut) {
    notices.push(`Disconnection notice: pay RM${arrears?.[1]} overdue by ${fmtDate(dmy(payBy[1]))}; disconnection from ${fmtDate(dmy(cut[1]))} to ${fmtDate(dmy(cut[2]))}.`);
  }
  const protect = text.match(/perlindungan bil elektrik sehingga (\d+) kWj/i);
  if (protect) {
    notices.push(`Bill protection extended to ${protect[1]} kWh/month: AFA, retail charge and SST adjustments are credited on the next bill.`);
  }

  return {
    provider: "tnb",
    accountNo,
    invoiceNo: after(text, /NO\. INVOIS/),
    billDate,
    periodStart: period ? dmy(period[1]) : null,
    periodEnd: period ? dmy(period[2]) : null,
    dueDate: due ? `${due[3]}-${MALAY_MONTHS[due[2].toUpperCase()]}-${due[1]}` : null,
    tariff: after(text, /TARIF/),
    usage: kwh ? { value: num(kwh[1]), unit: "kWh" } : null,
    currentCharges: num(current),
    previousBalance: num(after(text, /Baki Terdahulu \(RM\)/) ?? "0"),
    totalDue: num(must(after(text, /Jumlah Bil Anda \(RM\)/), "total due")),
    lineItems,
    history,
    notices,
    disconnection:
      payBy && cut
        ? { payBy: dmy(payBy[1]), from: dmy(cut[1]), to: dmy(cut[2]), amount: num(arrears?.[1] ?? "0") }
        : null,
    tnb: { afa, maxDemandKw: null },
  };
}

function translateCharge(label: string): string {
  return label
    .replace(/^Tenaga/i, "Energy")
    .replace(/^Kapasiti/i, "Capacity")
    .replace(/^Caj Rangkaian/i, "Network charge")
    .replace(/^Caj Peruncitan/i, "Retail charge")
    .replace(/^Insentif Cekap Tenaga/i, "Energy Efficiency Incentive (EEI)")
    .replace(/^Cukai Perkhidmatan/i, "Service tax (SST)")
    .replace(/mulai (\d{2}\/\d{2}\/\d{2})/i, "from $1");
}
