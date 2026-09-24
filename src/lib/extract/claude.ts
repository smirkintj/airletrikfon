import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { ExtractedBillSchema, type ExtractedBill } from "../types";

export const MODEL = "claude-opus-5";

const SYSTEM = `You extract structured data from Malaysian utility and telco bills (TNB electricity, Air Selangor water, Maxis and CelcomDigi mobile/fibre). Bills are often in Malay.

- Copy numbers exactly as printed; never compute or estimate a value that isn't on the bill.
- Dates as YYYY-MM-DD. Months in history as YYYY-MM of the bill month the bar or row is labelled with.
- Translate charge labels and notices into short, plain English.
- Leave out the account holder's name, address and phone numbers.
- Use null when a field isn't on the bill.
- lineItems are only the individual charges, rebates, taxes and rounding that add up to this period's charges. Leave out subtotals, previous balances, arrears, payments and totals.
- notices are only things specific to this account or bill: disconnection warnings, arrears, tariff or rebate changes that affect this bill, credits due. Leave out general terms, payment channels, deposits and marketing.
- Units: kWh for electricity, m³ for water.`;

export class ExtractionRefused extends Error {}

export async function extractWithClaude(pdf: Buffer): Promise<ExtractedBill> {
  const client = new Anthropic();
  const response = await client.beta.messages.parse({
    model: MODEL,
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: SYSTEM,
    messages: [
      {
        role: "user",
        content: [
          { type: "document", source: { type: "base64", media_type: "application/pdf", data: pdf.toString("base64") } },
          { type: "text", text: "Extract this bill." },
        ],
      },
    ],
    output_config: { format: betaZodOutputFormat(ExtractedBillSchema) },
  });

  if (response.stop_reason === "refusal") throw new ExtractionRefused("This document couldn\u2019t be read. Check that it\u2019s a bill.");
  if (response.stop_reason === "max_tokens") throw new Error("Bill extraction was cut off; try again.");
  if (!response.parsed_output) throw new Error("The bill couldn't be read reliably; try again.");
  return tidy(response.parsed_output);
}

/**
 * Normalise units and make sure line items add up to the printed charges. A single row
 * equal to the surplus is a subtotal the model included, so it's removed; anything else
 * that doesn't reconcile is dropped rather than shown wrong.
 */
export function tidy(bill: ExtractedBill): ExtractedBill {
  const unit = (u: string) => (/^m\^?3$|^m³$/i.test(u) ? "m³" : /^kwh$/i.test(u) ? "kWh" : u);
  const usage = bill.usage && { ...bill.usage, unit: unit(bill.usage.unit) };
  let lineItems = bill.lineItems.map((l) => ({ ...l, unit: l.unit && unit(l.unit) }));
  const total = (items: typeof lineItems) => items.reduce((s, l) => s + l.amount, 0);
  const close = (a: number, b: number) => Math.abs(a - b) <= 0.1;

  if (!close(total(lineItems), bill.currentCharges)) {
    const surplus = total(lineItems) - bill.currentCharges;
    const subtotals = lineItems.filter((l) => close(l.amount, surplus));
    lineItems = subtotals.length === 1 ? lineItems.filter((l) => l !== subtotals[0]) : [];
    if (!close(total(lineItems), bill.currentCharges)) lineItems = [];
    if (!lineItems.length) console.warn(`Line items don't add up to ${bill.currentCharges}; dropping them.`);
  }
  return { ...bill, usage, lineItems };
}
