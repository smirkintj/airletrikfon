import Anthropic from "@anthropic-ai/sdk";
import { MODEL } from "./extract/claude";
import { groupAccounts, insightsFor } from "./insights";
import { computeTnbBill } from "./tariffs/tnb";
import type { Bill } from "./types";

const SYSTEM = `You help one person in Malaysia understand their household bills (TNB electricity, Air Selangor water, Maxis/CelcomDigi telco).

You get their bill data as JSON, plus insights already computed by code. Answer their question from that data.
- The RM figures in the data and in computed insights are exact; quote them rather than recalculating.
- When you need a TNB what-if (e.g. "what if I used 550 kWh?"), use the tnb_bill tool instead of doing the arithmetic yourself.
- Be concrete and brief. Say so when the data can't answer something.
- Write plain text: short paragraphs, and lines starting with "- " for lists. No markdown formatting (no bold, headings or tables) and no emoji; the page shows your text as-is.`;

const tnbTool: Anthropic.Tool = {
  name: "tnb_bill",
  description:
    "Compute a TNB domestic electricity bill (July 2025 tariff) for a given monthly kWh. Returns each charge in RM and the total. AFA is only applied if afa_rate is given.",
  strict: true,
  input_schema: {
    type: "object",
    properties: {
      kwh: { type: "number", description: "Monthly usage in kWh" },
      afa_rate: { type: ["number", "null"], description: "AFA rate in RM/kWh from the latest bill, or null" },
    },
    required: ["kwh", "afa_rate"],
    additionalProperties: false,
  },
};

export async function askAboutBills(question: string, bills: Bill[]): Promise<string> {
  const client = new Anthropic();
  const accounts = groupAccounts(bills).map((a) => ({
    provider: a.provider,
    accountNo: a.accountNo,
    series: a.series,
    bills: a.bills.map((b) => ({ ...b, pdfPath: undefined })),
    insights: insightsFor(a),
  }));

  const messages: Anthropic.MessageParam[] = [
    {
      role: "user",
      content: `<bills>\n${JSON.stringify(accounts)}\n</bills>\n\nToday is ${new Date().toISOString().slice(0, 10)}.\n\n${question}`,
    },
  ];

  for (let turn = 0; turn < 5; turn++) {
    const response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: SYSTEM,
      tools: [tnbTool],
      messages,
    });

    if (response.stop_reason === "refusal") return "Sorry, I can't help with that question.";
    if (response.stop_reason !== "tool_use") {
      return response.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("\n").trim();
    }

    messages.push({ role: "assistant", content: response.content as Anthropic.ContentBlockParam[] });
    const results: Anthropic.ToolResultBlockParam[] = response.content.flatMap((b) => {
      if (b.type !== "tool_use") return [];
      const input = b.input as { kwh: number; afa_rate: number | null };
      const afa = input.afa_rate == null ? [] : [{ month: "any", rate: input.afa_rate }];
      return [{ type: "tool_result", tool_use_id: b.id, content: JSON.stringify(computeTnbBill(input.kwh, { afa })) }];
    });
    messages.push({ role: "user", content: results });
  }
  return "Sorry, that question took too many steps to answer. Try asking something more specific.";
}
