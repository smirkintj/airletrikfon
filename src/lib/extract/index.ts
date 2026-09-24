import { extractText, getDocumentProxy } from "unpdf";
import type { Bill, ExtractedBill } from "../types";
import { extractWithClaude } from "./claude";
import { looksLikeTnbBill, parseTnbText } from "./tnb-text";

export const hasClaude = () => Boolean(process.env.ANTHROPIC_API_KEY);

export class NeedsApiKey extends Error {
  constructor() {
    super("Only TNB bills can be read until an API key is set up. See the README.");
  }
}

/**
 * The model reads any provider's bill. Without an API key we fall back to the rule-based TNB
 * parser, so electricity bills still work locally.
 */
export async function extractBill(pdf: Buffer): Promise<{ bill: ExtractedBill; extractedBy: Bill["extractedBy"] }> {
  if (hasClaude()) return { bill: await extractWithClaude(pdf), extractedBy: "claude" };

  const doc = await getDocumentProxy(new Uint8Array(pdf));
  const { text } = await extractText(doc, { mergePages: true });
  if (!looksLikeTnbBill(text)) throw new NeedsApiKey();
  return { bill: parseTnbText(text), extractedBy: "tnb-text-parser" };
}
