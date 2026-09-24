import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export const supabaseEnabled = () =>
  Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

/** A per-request Supabase client acting as the signed-in user, so row-level security applies. */
export async function supabaseServer() {
  const store = await cookies();
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          list.forEach(({ name, value, options }) => store.set(name, value, options));
        } catch {
          // Called from a Server Component, where cookies are read-only; proxy.ts refreshes sessions.
        }
      },
    },
  });
}

export function isAllowedEmail(email: string | undefined | null) {
  const allowed = process.env.ALLOWED_EMAIL?.toLowerCase().split(",").map((e) => e.trim());
  return Boolean(email && allowed?.includes(email.toLowerCase()));
}
