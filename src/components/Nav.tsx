"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/", label: "Overview", key: "01" },
  { href: "/upload", label: "Add bill", key: "02" },
  { href: "/ask", label: "Ask", key: "03" },
];

export function Nav() {
  const path = usePathname();
  const active = (href: string) => (href === "/" ? path === "/" || path.startsWith("/bills") : path.startsWith(href));

  return (
    <>
      <header className="sticky top-0 z-20 border-b border-line bg-bg/90 backdrop-blur">
        <div className="mx-auto flex h-12 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="num flex items-center gap-2 text-sm font-semibold tracking-[0.18em]">
            <span className="inline-block h-2 w-2 rounded-full bg-amber" aria-hidden />
            BILLSIGHT
          </Link>
          <nav className="hidden gap-1 md:flex" aria-label="Main">
            {ITEMS.map((i) => (
              <Link
                key={i.href}
                href={i.href}
                aria-current={active(i.href) ? "page" : undefined}
                className={`num rounded px-3 py-1.5 text-xs tracking-wider uppercase transition-colors ${
                  active(i.href) ? "bg-panel-2 text-ink" : "text-muted hover:text-ink"
                }`}
              >
                <span className="text-amber-ink/70">{i.key}</span> {i.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      {/* Thumb-reach navigation on phones */}
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-bg/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
      >
        <div className="grid grid-cols-3">
          {ITEMS.map((i) => (
            <Link
              key={i.href}
              href={i.href}
              aria-current={active(i.href) ? "page" : undefined}
              className={`num flex h-14 flex-col items-center justify-center gap-0.5 text-[11px] tracking-wider uppercase ${
                active(i.href) ? "text-ink" : "text-muted"
              }`}
            >
              <span className={`h-0.5 w-6 ${active(i.href) ? "bg-amber" : "bg-transparent"}`} aria-hidden />
              {i.label}
            </Link>
          ))}
        </div>
      </nav>
    </>
  );
}
