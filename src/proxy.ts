import { NextResponse, type NextRequest } from "next/server";
import { auth, authEnabled } from "@/lib/auth";

/**
 * With Neon Auth configured, pages need a session (and refresh it); signed-out visitors go
 * to /login. API routes check the session themselves. Local mode passes everything through.
 */
export async function proxy(request: NextRequest) {
  if (!authEnabled()) return NextResponse.next();
  return auth().middleware({ loginUrl: "/login" })(request);
}

export const config = {
  matcher: ["/", "/upload", "/ask", "/bills/:path*"],
};
