import type { ExtractedBill, LineItem } from "../types";

/**
 * Rule-based parser for Air Selangor e-bill text (as produced by unpdf). Throws if the
 * layout doesn't match, so the caller can fall back to the model.
 */

const num = (s: string) => Number(s.replace(/,/g, ""));
const dmy = (s: string) => {
  const [d, m, y] = s.split("/");
  return `${y}-${m}-${d}`;
};

function must<T>(v: T | null | undefined, what: string): T {
  if (v == null) throw new Error(`Air Selangor parser: could not find ${what}`);
  return v;
}

export function looksLikeAirSelangorBill(text: string): boolean {
  return /Air Selangor/i.test(text) && /BIL AIR/i.test(text);
}

export function parseAirSelangorText(text: string): ExtractedBill {
  const accountNo = must(text.match(/No\. Akaun\s*:\s*(\d+)/i)?.[1], "account number");
  const billDate = dmy(must(text.match(/\nTarikh\s*:\s*(\d{2}\/\d{2}\/\d{4})/i)?.[1], "bill date"));

  // Readings table: "<meter> <current date> <days> <reading> <type> <usage>" then "<previous date> <reading> <type>"
  const cur = text.match(/^\S+ (\d{2}\/\d{2}\/\d{4}) (\d+) [\d,]+ [NE] (\d+)\s*\n(\d{2}\/\d{2}\/\d{4}) [\d,]+ [NE]/m);
  const billed = text.match(/Jumlah penggunaan yang dibilkan\s+([\d.,]+)/i);
  const due = text.match(/Bil Semasa \(Bayar Sebelum (\d{2}\/\d{2}\/\d{4})\) RM ([\d.,]+)/i);
  const outstanding = text.match(/Baki Belum Dijelaskan RM ([\d.,]+)/i);
  const total = must(text.match(/Jumlah Perlu Dibayar RM ([\d.,]+)/i)?.[1], "total due");

  const lineItems: LineItem[] = [];
  for (const m of text.matchAll(/^Caj bagi ([\d.]+) m3 pada RM([\d.]+) per m3 ([\d.,]+)$/gm)) {
    lineItems.push({ label: `${Number(m[1])} m³ at RM${m[2]}/m³`, amount: num(m[3]), quantity: Number(m[1]), unit: "m3", rate: Number(m[2]) });
  }
  const adjust = text.match(/^Pelarasan (-?[\d.,]+)$/m);
  if (adjust && num(adjust[1]) !== 0) lineItems.push({ label: "Adjustment", amount: num(adjust[1]), quantity: null, unit: null, rate: null });
  const rounding = text.match(/^Penggenapan (-?[\d.,]+)$/m);
  if (rounding && num(rounding[1]) !== 0) lineItems.push({ label: "Rounding", amount: num(rounding[1]), quantity: null, unit: null, rate: null });

  const usage = billed ? num(billed[1]) : cur ? Number(cur[3]) : null;
  const category = text.match(/Kategori\s*:\s*(\w+)/i)?.[1];

  return {
    provider: "air_selangor",
    accountNo,
    invoiceNo: text.match(/No\. Invois\s*:\s*(\d+)/i)?.[1] ?? null,
    billDate,
    periodStart: cur ? dmy(cur[4]) : null,
    periodEnd: cur ? dmy(cur[1]) : null,
    dueDate: due ? dmy(due[1]) : null,
    tariff: category ?? null,
    usage: usage != null ? { value: usage, unit: "m³" } : null,
    currentCharges: num(must(due?.[2], "current charges")),
    previousBalance: outstanding ? num(outstanding[1]) : 0,
    totalDue: num(total),
    lineItems,
    history: [],
    notices: [],
    disconnection: null,
    tnb: null,
  };
}
