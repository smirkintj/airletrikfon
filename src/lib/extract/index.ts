import { extractText, getDocumentProxy } from "unpdf";
import type { Bill, ExtractedBill } from "../types";
import { looksLikeAirSelangorBill, parseAirSelangorText } from "./air-selangor-text";
import { extractWithClaude } from "./claude";
import { looksLikeTnbBill, parseTnbText } from "./tnb-text";

export const hasClaude = () => Boolean(process.env.ANTHROPIC_API_KEY);

export class NeedsApiKey extends Error {
  constructor() {
    super("This bill's layout isn't built in yet, so it needs an API key to be read. See the README.");
  }
}

const PARSERS = [
  { detect: looksLikeTnbBill, parse: parseTnbText },
  { detect: looksLikeAirSelangorBill, parse: parseAirSelangorText },
];

/**
 * Known layouts (TNB, Air Selangor) go through the rule-based parsers: free, instant and
 * exact. Anything else, or a known layout the parser can't handle, goes to the model.
 */
export async function extractBill(pdf: Buffer): Promise<{ bill: ExtractedBill; extractedBy: Bill["extractedBy"] }> {
  const doc = await getDocumentProxy(new Uint8Array(pdf));
  const { text } = await extractText(doc, { mergePages: true });

  const parser = PARSERS.find((p) => p.detect(text));
  if (parser) {
    try {
      return { bill: parser.parse(text), extractedBy: "text-parser" };
    } catch (e) {
      if (!hasClaude()) throw e;
      console.warn("Parser failed, falling back to the model:", e instanceof Error ? e.message : e);
    }
  }
  if (!hasClaude()) throw new NeedsApiKey();
  return { bill: await extractWithClaude(pdf), extractedBy: "claude" };
}
