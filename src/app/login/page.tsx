import { redirect } from "next/navigation";
import { auth, authEnabled, isAllowedEmail } from "@/lib/auth";

export const dynamic = "force-dynamic";

const fields = (form: FormData) => ({
  email: String(form.get("email") ?? "").trim(),
  password: String(form.get("password") ?? ""),
});

async function signIn(form: FormData) {
  "use server";
  const { email, password } = fields(form);
  // Same message for a wrong password and a non-allowed address.
  if (!isAllowedEmail(email)) redirect("/login?error=signin");
  const { error } = await auth().signIn.email({ email, password });
  if (error) redirect("/login?error=signin");
  redirect("/");
}

/** First-time setup: only the allowed address can create its account. */
async function signUp(form: FormData) {
  "use server";
  const { email, password } = fields(form);
  if (!isAllowedEmail(email)) redirect("/login?mode=create&error=create");
  if (password.length < 10) redirect("/login?mode=create&error=short");
  const { error } = await auth().signUp.email({ email, password, name: email.split("@")[0] });
  if (error) redirect("/login?mode=create&error=create");
  redirect("/");
}

const ERRORS: Record<string, string> = {
  signin: "Wrong email or password.",
  create: "That account couldn't be created. It may already exist; try signing in.",
  short: "Use at least 10 characters.",
};

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  if (!authEnabled()) redirect("/");
  const { error, mode } = await searchParams;
  const creating = mode === "create";
  return (
    <div className="mx-auto mt-10 max-w-sm border border-line bg-panel p-6">
      <p className="label">{creating ? "Create your account" : "Sign in"}</p>
      <form action={creating ? signUp : signIn} className="mt-4 space-y-3">
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
            minLength={creating ? 10 : undefined}
            autoComplete={creating ? "new-password" : "current-password"}
            className="mt-1 w-full border border-line-2 bg-panel-2 px-3 py-2.5 outline-none focus:border-amber"
          />
        </label>
        {typeof error === "string" && ERRORS[error] && (
          <p role="alert" className="text-sm text-red">
            {ERRORS[error]}
          </p>
        )}
        <button className="num w-full bg-amber px-4 py-2.5 text-xs font-medium tracking-wider text-black uppercase">
          {creating ? "Create account" : "Sign in"}
        </button>
      </form>
      <a href={creating ? "/login" : "/login?mode=create"} className="label mt-4 block text-center hover:text-ink-2">
        {creating ? "Already set up? Sign in" : "First time here? Create your account"}
      </a>
    </div>
  );
}
