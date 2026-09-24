import { z } from "zod";

export const PROVIDERS = {
  tnb: { name: "TNB", category: "electricity" },
  air_selangor: { name: "Air Selangor", category: "water" },
  maxis: { name: "Maxis", category: "telco" },
  celcomdigi: { name: "CelcomDigi", category: "telco" },
  other: { name: "Other", category: "other" },
} as const;

export type ProviderId = keyof typeof PROVIDERS;
export type Category = (typeof PROVIDERS)[ProviderId]["category"];

const isoDate = z.string().describe("ISO date, YYYY-MM-DD");

export const LineItemSchema = z.object({
  label: z.string().describe("Charge name as printed, translated to English if in Malay"),
  amount: z.number().describe("RM amount, negative for rebates/credits"),
  quantity: z.number().nullable().describe("Units the charge applies to, e.g. kWh or m3"),
  unit: z.string().nullable(),
  rate: z.number().nullable().describe("RM per unit, if printed"),
});

export const HistoryPointSchema = z.object({
  month: z.string().describe("YYYY-MM of the bill month the history bar belongs to"),
  usage: z.number().nullable(),
  amount: z.number().nullable().describe("RM charged that month"),
});

/**
 * What we pull out of a bill PDF. Deliberately excludes the account holder's name and
 * address: nothing downstream needs them.
 */
export const ExtractedBillSchema = z.object({
  provider: z.enum(["tnb", "air_selangor", "maxis", "celcomdigi", "other"]),
  accountNo: z.string(),
  invoiceNo: z.string().nullable(),
  billDate: isoDate,
  periodStart: isoDate.nullable(),
  periodEnd: isoDate.nullable(),
  dueDate: isoDate.nullable(),
  tariff: z.string().nullable().describe("Tariff or plan name, e.g. 'Domestik Am' or a mobile plan name"),
  usage: z
    .object({ value: z.number(), unit: z.string().describe("kWh, m3, GB, etc.") })
    .nullable()
    .describe("Main metered usage this period; null for flat-rate telco plans"),
  currentCharges: z.number().describe("RM charges for this period only (Caj Semasa)"),
  previousBalance: z.number().describe("RM carried over from earlier bills (Baki Terdahulu / Tunggakan), 0 if none"),
  totalDue: z.number().describe("RM total amount payable on this bill"),
  lineItems: z.array(LineItemSchema),
  history: z.array(HistoryPointSchema).describe("Past months chart/table printed on the bill, if any"),
  notices: z
    .array(z.string())
    .describe("Important notices in English: disconnection warnings, arrears, tariff changes, rebates"),
  disconnection: z
    .object({ payBy: isoDate, from: isoDate, to: isoDate.nullable(), amount: z.number() })
    .nullable()
    .describe("Supply disconnection notice, if present"),
  tnb: z
    .object({
      afa: z
        .array(z.object({ month: z.string().describe("YYYY-MM"), rate: z.number().describe("RM/kWh") }))
        .describe("AFA rates printed on the bill per month"),
      maxDemandKw: z.number().nullable(),
    })
    .nullable()
    .describe("TNB-only details; null for other providers"),
});

export type ExtractedBill = z.infer<typeof ExtractedBillSchema>;
export type LineItem = z.infer<typeof LineItemSchema>;

export type Bill = ExtractedBill & {
  id: string;
  createdAt: string;
  extractedBy: "claude" | "text-parser" | "tnb-text-parser"; // tnb-text-parser: older records
  pdfPath: string | null;
};

export type Severity = "alert" | "warn" | "info" | "good";

export type Insight = {
  id: string;
  severity: Severity;
  title: string;
  detail: string;
  billId?: string;
};
