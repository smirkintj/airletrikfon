import { NextResponse, type NextRequest } from "next/server";
import { isAllowedEmail, supabaseServer } from "@/lib/supabase";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  if (code) {
    const sb = await supabaseServer();
    const { data } = await sb.auth.exchangeCodeForSession(code);
    if (data.user && isAllowedEmail(data.user.email)) return NextResponse.redirect(new URL("/", request.url));
    await sb.auth.signOut();
  }
  return NextResponse.redirect(new URL("/login", request.url));
}
