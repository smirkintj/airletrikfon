import { NextResponse } from "next/server";
import { ExtractionRefused } from "@/lib/extract/claude";
import { extractBill, NeedsApiKey } from "@/lib/extract";
import { getStore, NotConfigured, Unauthorized } from "@/lib/store";
import { PROVIDERS, type Category } from "@/lib/types";

const MAX_BYTES = 10 * 1024 * 1024;

export async function POST(request: Request) {
  try {
    const store = await getStore();
    const form = await request.formData();
    const file = form.get("file");
    const pickedCategory = form.get("category");
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

    // The category picker doesn't change what's detected from the PDF; it just gets a heads-up
    // when the file didn't match what the person picked (e.g. a water bill dropped under "Electricity").
    const detected = PROVIDERS[bill.provider].category;
    const mismatch =
      typeof pickedCategory === "string" && pickedCategory !== detected
        ? `Filed under ${categoryLabel(detected)} — that's what this PDF turned out to be, not ${categoryLabel(pickedCategory as Category)}.`
        : undefined;
    return NextResponse.json({ id: saved.id, mismatch });
  } catch (e) {
    if (e instanceof Unauthorized) return error("Please sign in again.", 401);
    if (e instanceof NotConfigured) return error("The app isn't set up yet.", 503);
    if (e instanceof NeedsApiKey || e instanceof ExtractionRefused) return error(e.message, 422);
    console.error(e);
    return error(e instanceof Error && / parser: /.test(e.message) ? e.message : "Couldn't read that bill.", 500);
  }
}

const error = (message: string, status: number) => NextResponse.json({ error: message }, { status });

const CATEGORY_LABELS: Record<Category, string> = { electricity: "Electricity", water: "Water", telco: "Phone", other: "Other" };
const categoryLabel = (c: Category) => CATEGORY_LABELS[c] ?? c;
