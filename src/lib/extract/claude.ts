import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { ExtractedBillSchema, type ExtractedBill } from "../types";

export const MODEL = "claude-opus-5";

const SYSTEM = `You extract structured data from Malaysian utility and telco bills (TNB electricity, Air Selangor water, Maxis and CelcomDigi mobile/fibre). Bills are often in Malay.

- Copy numbers exactly as printed; never compute or estimate a value that isn't on the bill.
- Dates as YYYY-MM-DD. Months in history as YYYY-MM of the bill month the bar or row is labelled with.
- Translate charge labels and notices into short, plain English.
- Leave out the account holder's name, address and phone numbers.
- Use null when a field isn't on the bill.`;

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
  return response.parsed_output;
}
