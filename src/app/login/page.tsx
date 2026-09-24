import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { isAllowedEmail, supabaseEnabled, supabaseServer } from "@/lib/supabase";

export const dynamic = "force-dynamic";

async function sendLink(formData: FormData) {
  "use server";
  const email = String(formData.get("email") ?? "").trim();
  // Only the allow-listed address gets a link; everyone else sees the same response.
  if (isAllowedEmail(email)) {
    const origin = (await headers()).get("origin");
    const sb = await supabaseServer();
    await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: `${origin}/auth/callback`, shouldCreateUser: true } });
  }
  redirect("/login?sent=1");
}

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  if (!supabaseEnabled()) redirect("/");
  const { sent } = await searchParams;
  return (
    <div className="mx-auto mt-10 max-w-sm border border-line bg-panel p-6">
      <p className="label">Sign in</p>
      {sent ? (
        <p className="mt-3 text-ink-2">If that address is allowed, a sign-in link is on its way. Check your inbox.</p>
      ) : (
        <form action={sendLink} className="mt-4 space-y-3">
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="you@example.com"
            className="w-full border border-line-2 bg-panel-2 px-3 py-2.5 outline-none focus:border-amber"
          />
          <button className="num w-full bg-amber px-4 py-2.5 text-xs font-medium tracking-wider text-black uppercase">Email me a link</button>
        </form>
      )}
    </div>
  );
}
