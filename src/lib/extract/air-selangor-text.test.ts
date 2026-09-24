import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildSeries, insightsFor } from "../insights";
import { computeWaterBill } from "../tariffs/air-selangor";
import type { Bill, ExtractedBill } from "../types";
import { looksLikeAirSelangorBill, parseAirSelangorText } from "./air-selangor-text";
import { looksLikeTnbBill } from "./tnb-text";

// Synthetic Air Selangor e-bill text in the layout unpdf produces (no real customer data).
const text = readFileSync(new URL("./__fixtures__/air-selangor-sample.txt", import.meta.url), "utf8");

describe("parseAirSelangorText", () => {
  const bill = parseAirSelangorText(text);

  it("detects the layout", () => {
    expect(looksLikeAirSelangorBill(text)).toBe(true);
    expect(looksLikeTnbBill(text)).toBe(false);
  });

  it("reads the header fields", () => {
    expect(bill).toMatchObject({
      provider: "air_selangor",
      accountNo: "7000000001",
      invoiceNo: "200000001",
      billDate: "2026-08-12",
      periodStart: "2026-07-13",
      periodEnd: "2026-08-12",
      dueDate: "2026-09-11",
      tariff: "Domestik",
      usage: { value: 38, unit: "m³" },
      currentCharges: 47.85,
      previousBalance: 31.2,
      totalDue: 79.05,
    });
  });

  it("reads the tier charges and rounding", () => {
    expect(bill.lineItems.map((l) => [l.quantity, l.rate, l.amount])).toEqual([
      [20, 0.65, 13],
      [15, 1.62, 24.3],
      [3, 3.51, 10.53],
      [null, null, 0.02],
    ]);
  });

  it("flags the top tier and the arrears", () => {
    const full: Bill = { ...bill, id: "w1", createdAt: "", extractedBy: "text-parser", pdfPath: null };
    const titles = insightsFor({ key: "k", provider: "air_selangor", accountNo: full.accountNo, bills: [full], series: buildSeries([full]) }).map((i) => i.title);
    expect(titles).toContain("RM31.20 unpaid from earlier Air Selangor bills");
    expect(titles).toContain("The last 3 m³ above 35 m³ cost RM10.53");
  });
});

describe("computeWaterBill", () => {
  it("charges each block at its own rate", () => {
    expect(computeWaterBill(38).total).toBe(47.83);
    expect(computeWaterBill(20).total).toBe(13);
    expect(computeWaterBill(35).total).toBe(37.3);
  });

  it("applies the minimum charge", () => {
    expect(computeWaterBill(3).total).toBe(6.5);
  });
});

describe("tidy (model output)", async () => {
  const { tidy } = await import("./claude");
  const base = parseAirSelangorText(text);

  it("normalises units", () => {
    expect(tidy({ ...base, usage: { value: 38, unit: "m3" } }).usage?.unit).toBe("m³");
  });

  it("removes a single subtotal row", () => {
    const subtotal = { label: "Usage charge - domestic", amount: 47.83, quantity: null, unit: null, rate: null };
    const amounts = (b: ExtractedBill) => tidy(b).lineItems.map((l) => l.amount);
    expect(amounts({ ...base, lineItems: [subtotal, ...base.lineItems] })).toEqual([13, 24.3, 10.53, 0.02]);
    expect(amounts(base)).toEqual([13, 24.3, 10.53, 0.02]);
    expect(tidy(base).lineItems[0].unit).toBe("m³");
  });

  it("drops line items that can't be reconciled", () => {
    const junk = [...base.lineItems, { label: "?", amount: 12.34, quantity: null, unit: null, rate: null }, { label: "?", amount: 5, quantity: null, unit: null, rate: null }];
    expect(tidy({ ...base, lineItems: junk }).lineItems).toEqual([]);
  });
});
