import { NextResponse } from "next/server";
import { ExtractionRefused } from "@/lib/extract/claude";
import { extractBill, NeedsApiKey } from "@/lib/extract";
import { getStore, Unauthorized } from "@/lib/store";

const MAX_BYTES = 10 * 1024 * 1024;

export async function POST(request: Request) {
  try {
    const store = await getStore();
    const file = (await request.formData()).get("file");
    if (!(file instanceof File)) return error("Choose a PDF to upload.", 400);
    if (file.type !== "application/pdf") return error("Only PDF bills are supported.", 400);
    if (file.size > MAX_BYTES) return error("That PDF is over 10 MB.", 400);

    const pdf = Buffer.from(await file.arrayBuffer());
    if (pdf.subarray(0, 5).toString() !== "%PDF-") return error("That file isn't a valid PDF.", 400);

    const { bill, extractedBy } = await extractBill(pdf);
    const existing = (await store.list()).find(
      (b) => b.provider === bill.provider && b.accountNo === bill.accountNo && b.billDate === bill.billDate,
    );
    if (existing) return NextResponse.json({ id: existing.id, duplicate: true });
    const saved = await store.add(bill, extractedBy, pdf);
    return NextResponse.json({ id: saved.id });
  } catch (e) {
    if (e instanceof Unauthorized) return error("Please sign in again.", 401);
    if (e instanceof NeedsApiKey || e instanceof ExtractionRefused) return error(e.message, 422);
    console.error(e);
    return error(e instanceof Error && / parser: /.test(e.message) ? e.message : "Couldn't read that bill.", 500);
  }
}

const error = (message: string, status: number) => NextResponse.json({ error: message }, { status });
