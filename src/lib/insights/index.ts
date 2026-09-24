import { computeWaterBill, tierCrossed } from "../tariffs/air-selangor";
import { computeTnbBill, protectionThreshold, rm, TNB } from "../tariffs/tnb";
import { fmtDate } from "../format";
import { PROVIDERS, type Bill, type Insight } from "../types";

export type SeriesPoint = { month: string; usage: number | null; amount: number | null; billId?: string };

export type Account = {
  key: string;
  provider: Bill["provider"];
  accountNo: string;
  bills: Bill[]; // oldest first
  series: SeriesPoint[]; // one point per bill month, oldest first
};

export function groupAccounts(bills: Bill[]): Account[] {
  const map = new Map<string, Bill[]>();
  for (const b of bills) {
    const key = `${b.provider}:${b.accountNo}`;
    map.set(key, [...(map.get(key) ?? []), b]);
  }
  return [...map.entries()].map(([key, list]) => {
    const sorted = list.sort((a, b) => a.billDate.localeCompare(b.billDate));
    return { key, provider: sorted[0].provider, accountNo: sorted[0].accountNo, bills: sorted, series: buildSeries(sorted) };
  });
}

/** Merge the uploaded bills with the history bars each bill prints about earlier months. */
export function buildSeries(bills: Bill[]): SeriesPoint[] {
  const points = new Map<string, SeriesPoint>();
  for (const b of bills) {
    for (const h of b.history) {
      if (!points.has(h.month)) points.set(h.month, { month: h.month, usage: h.usage, amount: h.amount });
    }
  }
  for (const b of bills) {
    const month = b.billDate.slice(0, 7);
    points.set(month, { month, usage: b.usage?.value ?? null, amount: b.currentCharges, billId: b.id });
  }
  return [...points.values()].sort((a, b) => a.month.localeCompare(b.month));
}

const fmt = (n: number) => `RM${n.toFixed(2)}`;
const pct = (n: number) => `${n > 0 ? "+" : ""}${Math.round(n * 100)}%`;
const name = (b: Bill) => PROVIDERS[b.provider].name;

export function insightsFor(account: Account, today = new Date().toISOString().slice(0, 10)): Insight[] {
  const out: Insight[] = [];
  const latest = account.bills[account.bills.length - 1];
  if (!latest) return out;

  out.push(...paymentInsights(latest, today));
  if (latest.provider === "tnb") out.push(...tnbInsights(latest, account.series));
  if (latest.provider === "air_selangor") out.push(...waterInsights(latest));
  out.push(...trendInsights(latest, account.series));
  return out;
}

function paymentInsights(b: Bill, today: string): Insight[] {
  const out: Insight[] = [];
  const d = b.disconnection;
  if (d) {
    const passed = today > d.payBy;
    out.push({
      id: `${b.id}:disconnect`,
      billId: b.id,
      severity: "alert",
      title: `${name(b)} disconnection notice: ${fmt(d.amount)} overdue`,
      detail: passed
        ? `The deadline (${fmtDate(d.payBy)}) has passed; disconnection can happen from ${fmtDate(d.from)}${d.to ? ` to ${fmtDate(d.to)}` : ""}. If you haven't paid, pay now and keep the receipt.`
        : `Pay at least ${fmt(d.amount)} by ${fmtDate(d.payBy)} to avoid disconnection from ${fmtDate(d.from)}.`,
    });
  } else if (b.previousBalance > 0) {
    out.push({
      id: `${b.id}:arrears`,
      billId: b.id,
      severity: "warn",
      title: `${fmt(b.previousBalance)} unpaid from earlier ${name(b)} bills`,
      detail: `The total due (${fmt(b.totalDue)}) includes arrears. Late payments can add a surcharge.`,
    });
  }
  return out;
}

function tnbInsights(b: Bill, series: SeriesPoint[]): Insight[] {
  const out: Insight[] = [];
  const kwh = b.usage?.value;
  if (kwh == null) return out;
  const opts = { periodStart: b.periodStart, periodEnd: b.periodEnd, afa: b.tnb?.afa ?? [] };
  const days = periodDays(b) ?? 30;

  if (kwh > TNB.protectionKwh) {
    const atLine = computeTnbBill(TNB.protectionKwh, opts);
    const actual = computeTnbBill(kwh, opts);
    const over = kwh - TNB.protectionKwh;
    const cost = rm(actual.total - atLine.total);
    const perDay = over / days;
    out.push({
      id: `${b.id}:cliff`,
      billId: b.id,
      severity: over <= 100 ? "warn" : "info",
      title: `The last ${over} kWh above 600 cost you ${fmt(cost)}`,
      detail:
        `Above 600 kWh, the retail charge, AFA fuel charge and SST all switch on, and your EEI rebate drops from ` +
        `${(atLine.eeiRate * 100).toFixed(1)} to ${(actual.eeiRate * 100).toFixed(1)} sen/kWh on every unit. ` +
        `Using ${over} kWh less over the ${days}-day period would have kept you at 600: about ${Math.max(1, Math.round((perDay / 0.75) * 60))} minutes less of a 1 hp aircon a day (a rough estimate).`,
    });
  }

  const threshold = protectionThreshold(b.periodStart);
  if (threshold > TNB.protectionKwh) {
    out.push({
      id: `${b.id}:threshold800`,
      billId: b.id,
      severity: "info",
      title: `From Sep 2026 usage, the limit is ${threshold} kWh`,
      detail: `TNB now credits back AFA, the retail charge and SST for usage up to ${threshold} kWh on the following bill, so the cliff moves from 600 to ${threshold} kWh.`,
    });
  }

  const recent = series.slice(-6).filter((p) => p.usage != null);
  const overCount = recent.filter((p) => (p.usage ?? 0) > TNB.protectionKwh).length;
  const nearCount = recent.filter((p) => Math.abs((p.usage ?? 0) - TNB.protectionKwh) <= 50).length;
  if (recent.length >= 3 && nearCount >= 3) {
    out.push({
      id: `${b.id}:hovering`,
      billId: b.id,
      severity: "info",
      title: `You've been within 50 kWh of 600 in ${nearCount} of the last ${recent.length} months`,
      detail: `${overCount} of those months went over. Your usage sits right on the most expensive line, so small cuts pay off more than usual.`,
    });
  }

  if (kwh > 1400 && kwh <= 1500) {
    out.push({
      id: `${b.id}:1500`,
      billId: b.id,
      severity: "warn",
      title: `${1500 - kwh} kWh away from the 1,500 kWh price jump`,
      detail: "Above 1,500 kWh, every unit is charged at 37.03 sen instead of 27.03 sen for energy.",
    });
  }
  return out;
}

function waterInsights(b: Bill): Insight[] {
  const out: Insight[] = [];
  const m3 = b.usage?.value;
  if (m3 == null) return out;
  const days = periodDays(b);
  const litresPerDay = days ? Math.round((m3 * 1000) / days) : null;

  const crossed = tierCrossed(m3);
  if (crossed) {
    const over = rm(m3 - crossed.boundary);
    const cost = rm(computeWaterBill(m3).total - computeWaterBill(crossed.boundary).total);
    out.push({
      id: `${b.id}:water-tier`,
      billId: b.id,
      severity: over <= 5 ? "warn" : "info",
      title: `The last ${over} m³ above ${crossed.boundary} m³ cost ${fmt(cost)}`,
      detail:
        `Water above ${crossed.boundary} m³ is charged at RM${crossed.rate.toFixed(2)}/m³, ${(crossed.rate / crossed.firstRate).toFixed(1)}× the first-tier rate. ` +
        (days && litresPerDay
          ? `You used about ${litresPerDay.toLocaleString("en-MY")} litres a day; about ${Math.round((over * 1000) / days)} litres a day less would have kept you at ${crossed.boundary} m³.`
          : ""),
    });
  } else if (litresPerDay) {
    out.push({
      id: `${b.id}:water-ok`,
      billId: b.id,
      severity: "good",
      title: `Water stayed in the cheapest tier (${m3} m³)`,
      detail: `About ${litresPerDay.toLocaleString("en-MY")} litres a day, all at RM0.65/m³.`,
    });
  }
  return out;
}

function trendInsights(b: Bill, series: SeriesPoint[]): Insight[] {
  const out: Insight[] = [];
  const latestMonth = b.billDate.slice(0, 7);
  const prior = series.filter((p) => p.month < latestMonth).slice(-6);
  const metric = b.usage ? "usage" : "amount";
  const vals = prior.map((p) => p[metric]).filter((v): v is number => v != null);
  const now = metric === "usage" ? b.usage!.value : b.currentCharges;
  if (vals.length < 2) return out;

  const avg = vals.reduce((s, v) => s + v, 0) / vals.length;
  const sd = Math.sqrt(vals.reduce((s, v) => s + (v - avg) ** 2, 0) / vals.length);
  const change = (now - avg) / avg;
  const unit = metric === "usage" ? ` ${b.usage!.unit}` : "";
  const shown = metric === "usage" ? `${now}${unit}` : fmt(now);
  const avgShown = metric === "usage" ? `${Math.round(avg)}${unit}` : fmt(avg);

  if (vals.length >= 4 && sd > 0 && now > avg + 2 * sd) {
    out.push({
      id: `${b.id}:spike`,
      billId: b.id,
      severity: "warn",
      title: `Unusual ${name(b)} spike: ${shown} vs your usual ${avgShown}`,
      detail: `That's ${pct(change)} over your ${vals.length}-month average and outside your normal range. Check for a leak, a faulty appliance, or unexpected charges.`,
    });
  } else if (Math.abs(change) >= 0.1) {
    out.push({
      id: `${b.id}:trend`,
      billId: b.id,
      severity: change > 0 ? "info" : "good",
      title: `${name(b)} ${metric} ${pct(change)} vs your ${vals.length}-month average`,
      detail: `${shown} this bill against an average of ${avgShown}.`,
    });
  }
  return out;
}

function periodDays(b: Bill): number | null {
  if (!b.periodStart || !b.periodEnd) return null;
  return Math.round((Date.parse(b.periodEnd) - Date.parse(b.periodStart)) / 86_400_000) + 1;
}

const ORDER = { alert: 0, warn: 1, info: 2, good: 3 } as const;
export function sortInsights(list: Insight[]): Insight[] {
  return [...list].sort((a, b) => ORDER[a.severity] - ORDER[b.severity]);
}
