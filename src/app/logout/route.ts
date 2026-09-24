import { NextResponse, type NextRequest } from "next/server";
import { auth, authEnabled } from "@/lib/auth";

export async function POST(request: NextRequest) {
  if (authEnabled()) await auth().signOut();
  return NextResponse.redirect(new URL("/login", request.url), 303);
}
