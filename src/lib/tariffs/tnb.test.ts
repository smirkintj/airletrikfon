import { describe, expect, it } from "vitest";
import { computeTnbBill, eeiRate, splitByMonth } from "./tnb";

// A synthetic Domestik Am bill in TNB's printed format (612 kWh, 5 Jul – 4 Aug 2026). The
// expected figures were worked out by hand from the published rates, independently of this
// engine; the rounding rules were first confirmed against a real bill.
const sample = {
  periodStart: "2026-07-05",
  periodEnd: "2026-08-04",
  afa: [
    { month: "2026-07", rate: 0.029 },
    { month: "2026-08", rate: 0.0335 },
  ],
};

describe("computeTnbBill", () => {
  it("matches a printed bill line by line", () => {
    const b = computeTnbBill(612, sample);
    expect(b.energy).toBe(165.42);
    expect(b.afa).toBe(18.11);
    expect(b.capacity).toBe(27.85);
    expect(b.network).toBe(78.64);
    expect(b.retail).toBe(10);
    expect(b.eei).toBe(-45.9);
    expect(b.sst).toBe(1.18);
    expect(b.kwtbb).toBe(3.62);
    expect(b.total).toBe(258.92);
  });

  it("drops AFA, retail and SST at exactly 600 kWh", () => {
    const b = computeTnbBill(600, sample);
    expect(b.afa).toBe(0);
    expect(b.retail).toBe(0);
    expect(b.sst).toBe(0);
    expect(b.eeiRate).toBe(0.09);
    expect(b.total).toBe(215.98);
  });

  it("exempts KWTBB at 300 kWh and below", () => {
    expect(computeTnbBill(300).kwtbb).toBe(0);
    expect(computeTnbBill(301).kwtbb).toBeGreaterThan(0);
  });

  it("reprices all energy above 1,500 kWh", () => {
    expect(computeTnbBill(1501).energy).toBeCloseTo(1501 * 0.3703, 1);
  });
});

describe("helpers", () => {
  it("prorates AFA kWh by days per month", () => {
    expect(splitByMonth(612, "2026-07-05", "2026-08-04")).toEqual([
      { month: "2026-07", kwh: 533 },
      { month: "2026-08", kwh: 79 },
    ]);
  });

  it("picks the EEI band for the whole consumption", () => {
    expect(eeiRate(200)).toBe(0.25);
    expect(eeiRate(601)).toBe(0.075);
    expect(eeiRate(1001)).toBe(0);
  });
});
