import { NextResponse, type NextRequest } from "next/server";
import { supabaseEnabled, supabaseServer } from "@/lib/supabase";

export async function POST(request: NextRequest) {
  if (supabaseEnabled()) await (await supabaseServer()).auth.signOut();
  return NextResponse.redirect(new URL("/login", request.url), 303);
}
