/**
 * TNB domestic tariff (structure effective 1 July 2025).
 *
 * Rates are from TNB's published schedule. The rounding, and which charges KWTBB and SST
 * apply to, match how TNB prints its bills (see tnb.test.ts).
 */

export type AfaRate = { month: string; rate: number }; // month = YYYY-MM, rate in RM/kWh

export type TnbCharges = {
  kwh: number;
  energy: number;
  capacity: number;
  network: number;
  afa: number;
  retail: number;
  eei: number;
  sst: number;
  kwtbb: number;
  total: number;
  eeiRate: number;
};

export const TNB = {
  energyRate: 0.2703,
  energyRateAbove1500: 0.3703, // applies to ALL kWh once usage exceeds 1,500
  capacityRate: 0.0455,
  networkRate: 0.1285,
  retailCharge: 10,
  sstRate: 0.08,
  kwtbbRate: 0.016,
  kwtbbExemptUpToKwh: 300,
  // Retail charge, AFA and SST only apply once usage goes above this.
  protectionKwh: 600,
  // [upper kWh bound inclusive, RM/kWh rebate], applied to the whole consumption.
  eeiBands: [
    [200, 0.25], [250, 0.245], [300, 0.225], [350, 0.21], [400, 0.17], [450, 0.145],
    [500, 0.12], [550, 0.105], [600, 0.09], [650, 0.075], [700, 0.055], [750, 0.045],
    [800, 0.04], [850, 0.025], [900, 0.01], [1000, 0.005],
  ] as [number, number][],
};

/**
 * TNB extended the 600 kWh protection to 800 kWh for usage from Sep 2026 (per the bill
 * notice): AFA, retail charge and SST up to 800 kWh are billed as usual and credited
 * back on the following bill. Returns the effective threshold for a period's usage month.
 */
export function protectionThreshold(periodStart: string | null): number {
  return periodStart && periodStart >= "2026-09-01" ? 800 : TNB.protectionKwh;
}

export function eeiRate(kwh: number): number {
  for (const [upTo, rate] of TNB.eeiBands) if (kwh <= upTo) return rate;
  return 0;
}

/** Round half away from zero to sen, matching TNB's line rounding. */
export function rm(x: number): number {
  return Math.sign(x) * Math.round(Math.abs(x) * 100 + 1e-9) / 100;
}

function daysBetween(a: Date, b: Date) {
  return Math.round((b.getTime() - a.getTime()) / 86_400_000) + 1;
}

/**
 * Split kWh across calendar months by days, the way TNB prorates AFA, e.g. a 5 Jul – 4 Aug
 * period of 612 kWh becomes 533 kWh in Jul and 79 kWh in Aug.
 */
export function splitByMonth(kwh: number, start: string, end: string): { month: string; kwh: number }[] {
  const s = new Date(start + "T00:00:00Z");
  const e = new Date(end + "T00:00:00Z");
  const total = daysBetween(s, e);
  const parts: { month: string; days: number }[] = [];
  for (let d = new Date(s); d <= e; d.setUTCDate(d.getUTCDate() + 1)) {
    const month = d.toISOString().slice(0, 7);
    const last = parts[parts.length - 1];
    if (last?.month === month) last.days++;
    else parts.push({ month, days: 1 });
  }
  let assigned = 0;
  return parts.map((p, i) => {
    const share = i === parts.length - 1 ? kwh - assigned : Math.round((kwh * p.days) / total);
    assigned += share;
    return { month: p.month, kwh: share };
  });
}

type Options = {
  periodStart?: string | null;
  periodEnd?: string | null;
  afa?: AfaRate[];
  /** Override the protection threshold, e.g. for what-if comparisons. */
  protectionKwh?: number;
};

/** Compute a domestic bill for `kwh` of usage, as TNB would print it (before credits). */
export function computeTnbBill(kwh: number, opts: Options = {}): TnbCharges {
  const threshold = opts.protectionKwh ?? TNB.protectionKwh;
  const over = kwh > threshold;
  const energyRate = kwh > 1500 ? TNB.energyRateAbove1500 : TNB.energyRate;
  const eRate = eeiRate(kwh);

  // SST is levied on the share of consumption above 600 kWh (plus the retail charge), so
  // TNB prints every per-kWh charge in two columns: untaxed and taxed kWh.
  const taxedKwh = over && kwh > TNB.protectionKwh ? kwh - TNB.protectionKwh : 0;
  const untaxedKwh = kwh - taxedKwh;
  const perKwh = (rate: number) => rm(rm(untaxedKwh * rate) + rm(taxedKwh * rate));

  const energy = perKwh(energyRate);
  const capacity = perKwh(TNB.capacityRate);
  const network = perKwh(TNB.networkRate);
  const eei = perKwh(-eRate);

  let afa = 0;
  let afaTaxed = 0;
  if (over && opts.afa?.length) {
    const segments =
      opts.periodStart && opts.periodEnd
        ? splitByMonth(kwh, opts.periodStart, opts.periodEnd)
        : [{ month: opts.afa[opts.afa.length - 1].month, kwh }];
    let taxedLeft = taxedKwh;
    for (const seg of segments) {
      const rate = (opts.afa.find((a) => a.month === seg.month) ?? opts.afa[opts.afa.length - 1]).rate;
      const segTaxed = Math.min(taxedLeft, seg.kwh);
      taxedLeft -= segTaxed;
      afa += rm((seg.kwh - segTaxed) * rate) + rm(segTaxed * rate);
      afaTaxed += rm(segTaxed * rate);
    }
  }

  const retail = over ? TNB.retailCharge : 0;
  const taxable =
    rm(taxedKwh * energyRate) + rm(taxedKwh * TNB.capacityRate) + rm(taxedKwh * TNB.networkRate) +
    rm(taxedKwh * -eRate) + afaTaxed + (taxedKwh > 0 ? retail : 0);
  const sst = rm(rm(taxable) * TNB.sstRate);

  // KWTBB is on the base charges after EEI, excluding AFA and the retail charge.
  const kwtbb = kwh > TNB.kwtbbExemptUpToKwh ? rm((energy + capacity + network + eei) * TNB.kwtbbRate) : 0;

  const total = rm(energy + capacity + network + afa + retail + eei + sst + kwtbb);
  return { kwh, energy, capacity, network, afa: rm(afa), retail, eei, sst, kwtbb, total, eeiRate: eRate };
}
