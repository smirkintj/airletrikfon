import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildSeries, insightsFor } from "../insights";
import type { Bill } from "../types";
import { looksLikeTnbBill, parseTnbText } from "./tnb-text";

// Synthetic TNB e-bill text in the layout unpdf produces (no real customer data).
const text = readFileSync(new URL("./__fixtures__/tnb-sample.txt", import.meta.url), "utf8");

describe("parseTnbText", () => {
  const bill = parseTnbText(text);

  it("detects a TNB bill", () => expect(looksLikeTnbBill(text)).toBe(true));

  it("reads the header fields", () => {
    expect(bill).toMatchObject({
      accountNo: "210000000001",
      billDate: "2026-08-06",
      periodStart: "2026-07-05",
      periodEnd: "2026-08-04",
      dueDate: "2026-09-05",
      tariff: "Domestik Am",
      usage: { value: 612, unit: "kWh" },
      currentCharges: 258.92,
      previousBalance: 236.75,
      totalDue: 495.67,
    });
  });

  it("reads charges and AFA rates", () => {
    expect(bill.lineItems.map((l) => l.amount)).toEqual([165.42, 15.46, 2.65, 27.85, 78.64, 10, -45.9, 1.18, 3.62]);
    expect(bill.tnb?.afa).toEqual([
      { month: "2026-07", rate: 0.029 },
      { month: "2026-08", rate: 0.0335 },
    ]);
  });

  it("reads the 6-month history", () => {
    expect(bill.history).toHaveLength(6);
    expect(bill.history[0]).toEqual({ month: "2026-03", usage: 548, amount: 205.4 });
    expect(bill.history[5]).toEqual({ month: "2026-08", usage: 612, amount: 258.92 });
  });

  it("reads the disconnection notice", () => {
    expect(bill.disconnection).toEqual({ payBy: "2026-08-16", from: "2026-08-17", to: "2026-08-26", amount: 236.75 });
  });

  it("produces the expected insights", () => {
    const full: Bill = { ...bill, id: "b1", createdAt: "", extractedBy: "tnb-text-parser", pdfPath: null };
    const insights = insightsFor({ key: "k", provider: "tnb", accountNo: full.accountNo, bills: [full], series: buildSeries([full]) }, "2026-08-20");
    const titles = insights.map((i) => i.title);
    expect(titles[0]).toMatch(/disconnection notice/);
    expect(titles).toContain("The last 12 kWh above 600 cost you RM42.94");
    expect(titles.some((t) => /within 50 kWh of 600/.test(t))).toBe(true);
  });
});
