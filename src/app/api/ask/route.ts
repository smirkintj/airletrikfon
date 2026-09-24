import { NextResponse } from "next/server";
import { askAboutBills } from "@/lib/ask";
import { hasClaude } from "@/lib/extract";
import { getStore, Unauthorized } from "@/lib/store";

export async function POST(request: Request) {
  try {
    const store = await getStore();
    if (!hasClaude()) {
      return NextResponse.json({ error: "Questions need an API key to be set up. See the README." }, { status: 422 });
    }
    const { question } = await request.json();
    if (typeof question !== "string" || !question.trim() || question.length > 2000) {
      return NextResponse.json({ error: "Ask a question (up to 2,000 characters)." }, { status: 400 });
    }
    return NextResponse.json({ answer: await askAboutBills(question.trim(), await store.list()) });
  } catch (e) {
    if (e instanceof Unauthorized) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
    console.error(e);
    return NextResponse.json({ error: "Something went wrong answering that." }, { status: 500 });
  }
}
