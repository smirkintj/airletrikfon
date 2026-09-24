import { NextResponse } from "next/server";
import { getStore, NotConfigured, Unauthorized } from "@/lib/store";

/** The original uploaded PDF for a bill, so it can be reopened later (not just its extracted charges). */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const store = await getStore();
    const bill = await store.get(id);
    if (!bill) return error("Bill not found.", 404);
    const pdf = await store.getPdf(id);
    if (!pdf) return error("The original PDF isn't available for this bill.", 404);
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${bill.provider}-${bill.billDate}.pdf"`,
      },
    });
  } catch (e) {
    if (e instanceof Unauthorized) return error("Please sign in again.", 401);
    if (e instanceof NotConfigured) return error("The app isn't set up yet.", 503);
    throw e;
  }
}

const error = (message: string, status: number) => NextResponse.json({ error: message }, { status });
