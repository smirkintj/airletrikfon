import "server-only";
import { createNeonAuth } from "@neondatabase/auth/next/server";

/** Neon Auth is on when its URL and cookie secret are configured; otherwise the app runs in local mode. */
export const authEnabled = () => Boolean(process.env.NEON_AUTH_BASE_URL && process.env.NEON_AUTH_COOKIE_SECRET);

let instance: ReturnType<typeof createNeonAuth> | null = null;
export function auth() {
  instance ??= createNeonAuth({
    baseUrl: process.env.NEON_AUTH_BASE_URL!,
    cookies: { secret: process.env.NEON_AUTH_COOKIE_SECRET! },
  });
  return instance;
}

/**
 * Only these addresses may use the app. Neon Auth itself lets anyone sign up, so every data
 * access checks this list too.
 */
export function isAllowedEmail(email: string | undefined | null) {
  const allowed = process.env.ALLOWED_EMAIL?.toLowerCase().split(",").map((e) => e.trim()).filter(Boolean);
  return Boolean(email && allowed?.includes(email.toLowerCase()));
}

/** The signed-in, allow-listed user, or null. */
export async function currentUser(): Promise<{ id: string; email: string } | null> {
  const { data: session } = await auth().getSession();
  const user = session?.user;
  return user && isAllowedEmail(user.email) ? { id: user.id, email: user.email } : null;
}
