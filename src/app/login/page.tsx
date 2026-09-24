import { redirect } from "next/navigation";
import { isAllowedEmail, supabaseEnabled, supabaseServer } from "@/lib/supabase";

export const dynamic = "force-dynamic";

async function signIn(formData: FormData) {
  "use server";
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  // Same message for a wrong password and a non-allowed address.
  if (!isAllowedEmail(email)) redirect("/login?error=1");
  const sb = await supabaseServer();
  const { error } = await sb.auth.signInWithPassword({ email, password });
  if (error) redirect("/login?error=1");
  redirect("/");
}

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  if (!supabaseEnabled()) redirect("/");
  const { error } = await searchParams;
  return (
    <div className="mx-auto mt-10 max-w-sm border border-line bg-panel p-6">
      <p className="label">Sign in</p>
      <form action={signIn} className="mt-4 space-y-3">
        <label className="block">
          <span className="label">Email</span>
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
            className="mt-1 w-full border border-line-2 bg-panel-2 px-3 py-2.5 outline-none focus:border-amber"
          />
        </label>
        <label className="block">
          <span className="label">Password</span>
          <input
            name="password"
            type="password"
            required
            autoComplete="current-password"
            className="mt-1 w-full border border-line-2 bg-panel-2 px-3 py-2.5 outline-none focus:border-amber"
          />
        </label>
        {error && (
          <p role="alert" className="text-sm text-red">
            Wrong email or password.
          </p>
        )}
        <button className="num w-full bg-amber px-4 py-2.5 text-xs font-medium tracking-wider text-black uppercase">Sign in</button>
      </form>
    </div>
  );
}
