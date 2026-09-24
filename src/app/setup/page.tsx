import { redirect } from "next/navigation";
import { authEnabled } from "@/lib/auth";

export const dynamic = "force-dynamic";

const CHECKS = [
  { key: "DATABASE_URL", what: "Database" },
  { key: "NEON_AUTH_BASE_URL", what: "Login service" },
  { key: "NEON_AUTH_COOKIE_SECRET", what: "Session cookie secret" },
  { key: "AWS_ENDPOINT_URL_S3", what: "Bill file storage" },
  { key: "ALLOWED_EMAIL", what: "Allowed email" },
  { key: "ANTHROPIC_API_KEY", what: "Reading other bills and Ask (optional)" },
];

/** Shown on a deployment that's missing its settings. Lists only which are set, never values. */
export default function SetupPage() {
  if (process.env.DATABASE_URL && authEnabled()) redirect("/");
  return (
    <div className="mx-auto mt-6 max-w-lg border border-line bg-panel">
      <header className="border-b border-line px-4 py-2.5">
        <h1 className="num text-xs font-medium tracking-wider uppercase">Setup needed</h1>
      </header>
      <div className="space-y-4 p-4 text-sm">
        <p className="text-ink-2">
          This deployment has no database or login configured, so it won&apos;t show any bills. Add the missing settings
          in Vercel → Project → Settings → Environment Variables, then redeploy.
        </p>
        <ul className="num divide-y divide-line border-y border-line">
          {CHECKS.map((c) => {
            const ok = Boolean(process.env[c.key]);
            return (
              <li key={c.key} className="flex items-center justify-between gap-3 py-2">
                <span className="min-w-0">
                  <span className="block font-sans text-ink">{c.what}</span>
                  <span className="text-xs text-muted">{c.key}</span>
                </span>
                <span className={`shrink-0 border px-1.5 py-px text-[10px] tracking-widest uppercase ${ok ? "border-ok text-ok" : "border-line-2 text-muted"}`}>
                  {ok ? "Set" : "Missing"}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
