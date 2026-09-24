import type { ReactNode } from "react";
import type { Insight, Severity } from "@/lib/types";

export function Panel({ title, meta, children, className = "" }: { title?: ReactNode; meta?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`border border-line bg-panel ${className}`}>
      {(title || meta) && (
        <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-line px-4 py-2.5">
          <h2 className="num text-xs font-medium tracking-wider text-ink uppercase">{title}</h2>
          {meta && <div className="num text-xs text-muted">{meta}</div>}
        </header>
      )}
      <div className="p-4">{children}</div>
    </section>
  );
}

export function Readout({ label, value, unit, tone = "ink", size = "md" }: { label: string; value: string; unit?: string; tone?: "ink" | "amber" | "red"; size?: "md" | "lg" }) {
  const color = tone === "amber" ? "text-amber-ink" : tone === "red" ? "text-red" : "text-ink";
  return (
    <div className="min-w-0">
      <p className="label">{label}</p>
      <p className={`num mt-1 leading-none font-medium ${color} ${size === "lg" ? "text-4xl sm:text-5xl" : "text-2xl"}`}>
        {unit === "RM" && <span className="mr-1 text-[0.5em] text-muted">RM</span>}
        {value}
        {unit && unit !== "RM" && <span className="ml-1 text-[0.5em] text-muted">{unit}</span>}
      </p>
    </div>
  );
}

const TAG: Record<Severity, { text: string; cls: string }> = {
  alert: { text: "Action", cls: "border-red text-red" },
  warn: { text: "Check", cls: "border-amber text-amber-ink" },
  info: { text: "Note", cls: "border-line-2 text-ink-2" },
  good: { text: "OK", cls: "border-ok text-ok" },
};

export function Tag({ severity }: { severity: Severity }) {
  const t = TAG[severity];
  return <span className={`num inline-block shrink-0 border px-1.5 py-px text-[10px] tracking-widest uppercase ${t.cls}`}>{t.text}</span>;
}

export function Findings({ insights }: { insights: Insight[] }) {
  if (!insights.length) return <p className="text-sm text-muted">Nothing to flag. Add a few months of bills to see trends.</p>;
  return (
    <ol className="divide-y divide-line">
      {insights.map((i, n) => (
        <li key={i.id} className={`grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 py-3 first:pt-0 last:pb-0 ${i.severity === "alert" ? "-mx-4 bg-[var(--red-bg)] px-4 first:pt-3" : ""}`}>
          <span className="num pt-0.5 text-xs text-muted">{String(n + 1).padStart(2, "0")}</span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-start gap-2">
              <Tag severity={i.severity} />
              <p className="font-medium">{i.title}</p>
            </div>
            <p className="mt-1 text-sm text-ink-2">{i.detail}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

/** Horizontal meter: this bill's usage against the tariff line. */
export function Gauge({ value, line, unit }: { value: number; line: number; unit: string }) {
  const step = Math.max(value, line) <= 80 ? 10 : 100;
  const max = Math.max(Math.ceil((Math.max(value, line) * 1.25) / step) * step, step);
  const pct = (v: number) => `${(v / max) * 100}%`;
  const under = Math.min(value, line);
  const ticks = Array.from({ length: max / step + 1 }, (_, i) => i * step);
  return (
    <div role="img" aria-label={`${value} ${unit} against a ${line} ${unit} line`}>
      <div className="relative h-5 border border-line bg-panel-2">
        <div className="absolute inset-y-0 left-0 bg-amber" style={{ width: pct(under) }} />
        {value > line && <div className="hatch absolute inset-y-0" style={{ left: pct(line), width: pct(value - line) }} />}
        <div className="absolute -inset-y-1.5 w-px bg-ink" style={{ left: pct(line) }} />
      </div>
      <p className="num relative h-0 text-[10px] text-ink">
        <span className="absolute -top-8 -translate-x-1/2 bg-panel px-0.5" style={{ left: pct(line) }}>
          {line}
        </span>
      </p>
      <div className="relative mt-1 h-4">
        {ticks.map((t) => (
          <span
            key={t}
            className={`num absolute -translate-x-1/2 text-[10px] text-muted ${t % (step * 2) && max / step > 10 ? "hidden sm:inline" : ""}`}
            style={{ left: pct(t) }}
          >
            {t}
          </span>
        ))}
      </div>
    </div>
  );
}

export function Leaders({ rows }: { rows: { label: ReactNode; value: string; tone?: "ok" | "strong" }[] }) {
  return (
    <dl className="num text-sm">
      {rows.map((r, i) => (
        <div key={i} className={`flex items-baseline gap-2 py-1.5 ${r.tone === "strong" ? "mt-1 border-t border-line-2 pt-2.5 font-medium" : ""}`}>
          <dt className="min-w-0 shrink font-sans text-ink-2">{r.label}</dt>
          <span className="min-w-4 flex-1 translate-y-[-3px] border-b border-dotted border-line-2" aria-hidden />
          <dd className={`shrink-0 ${r.tone === "ok" ? "text-ok" : "text-ink"}`}>{r.value}</dd>
        </div>
      ))}
    </dl>
  );
}
