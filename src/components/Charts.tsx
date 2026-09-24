"use client";

import { useState } from "react";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const monthLabel = (m: string) => `${MONTHS[Number(m.slice(5, 7)) - 1]} ${m.slice(2, 4)}`;
const rm = (n: number) => `RM${n.toFixed(2)}`;

function niceMax(v: number) {
  const step = 10 ** Math.floor(Math.log10(v || 1));
  return Math.ceil((v * 1.1) / step) * step;
}

type Point = { month: string; usage: number | null; amount: number | null };

/**
 * Monthly usage bars in plain CSS, so they reflow at any width. Tap, hover or arrow-key
 * across the bars; the readout line shows the selected month.
 */
export function UsageChart({ data, unit, threshold }: { data: Point[]; unit: string; threshold?: number }) {
  const rows = data.filter((d) => d.usage != null) as (Point & { usage: number })[];
  const [sel, setSel] = useState(rows.length - 1);
  if (!rows.length) return null;
  const max = niceMax(Math.max(...rows.map((r) => r.usage), threshold ?? 0));
  const h = (v: number) => `${(v / max) * 100}%`;
  const cur = rows[Math.min(sel, rows.length - 1)];

  return (
    <figure>
      <figcaption className="num mb-3 flex flex-wrap items-baseline gap-x-3 text-sm" aria-live="polite">
        <span className="text-muted">{monthLabel(cur.month).toUpperCase()}</span>
        <span className="text-ink">
          {cur.usage} {unit}
        </span>
        {cur.amount != null && <span className="text-ink-2">{rm(cur.amount)}</span>}
        {threshold && cur.usage > threshold && <span className="text-amber-ink">+{cur.usage - threshold} over line</span>}
      </figcaption>

      <div className="flex gap-2">
        <div className="num relative w-8 shrink-0 text-right text-[10px] text-muted" aria-hidden>
          <span className="absolute right-0 top-0 -translate-y-1/2">{max}</span>
          <span className="absolute right-0 top-1/2 -translate-y-1/2">{max / 2}</span>
          <span className="absolute right-0 bottom-0 translate-y-1/2">0</span>
          {threshold && (
            <span className="absolute right-0 translate-y-1/2 bg-panel pl-0.5 text-ink" style={{ bottom: h(threshold) }}>
              {threshold}
            </span>
          )}
        </div>
        <div
          className="relative h-44 flex-1 border-b border-line-2 sm:h-52"
          role="listbox"
          aria-label={`Monthly usage in ${unit}`}
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "ArrowLeft") setSel((s) => Math.max(0, s - 1));
            if (e.key === "ArrowRight") setSel((s) => Math.min(rows.length - 1, s + 1));
          }}
        >
          <div className="absolute inset-x-0 top-0 border-t border-dashed border-line" aria-hidden />
          <div className="absolute inset-x-0 top-1/2 border-t border-dashed border-line" aria-hidden />
          {threshold && (
            <div className="absolute inset-x-0 z-10 border-t border-ink/70" style={{ bottom: h(threshold) }} aria-hidden />
          )}
          <div className="absolute inset-0 flex items-end justify-around gap-[4%] px-[3%]">
            {rows.map((r, i) => {
              const under = threshold ? Math.min(r.usage, threshold) : r.usage;
              const over = threshold && r.usage > threshold ? r.usage - threshold : 0;
              return (
                <button
                  key={r.month}
                  type="button"
                  role="option"
                  aria-selected={i === sel}
                  aria-label={`${monthLabel(r.month)}: ${r.usage} ${unit}`}
                  tabIndex={-1}
                  onMouseEnter={() => setSel(i)}
                  onFocus={() => setSel(i)}
                  onClick={() => setSel(i)}
                  className="group relative flex h-full max-w-12 flex-1 flex-col justify-end"
                >
                  <span className={`absolute inset-x-[-15%] inset-y-0 ${i === sel ? "bg-ink/5" : ""}`} aria-hidden />
                  {over > 0 && <span className="hatch relative block rounded-t-[3px]" style={{ height: h(over) }} />}
                  <span
                    className={`relative block bg-amber transition-opacity ${over ? "" : "rounded-t-[3px]"} ${i === sel ? "" : "opacity-80"}`}
                    style={{ height: h(under) }}
                  />
                </button>
              );
            })}
          </div>
        </div>
      </div>
      <div className="ml-10 flex justify-around gap-[4%] px-[3%] pt-1.5">
        {rows.map((r, i) => (
          <span key={r.month} className={`num max-w-12 flex-1 text-center text-[10px] ${i === sel ? "text-ink" : "text-muted"}`}>
            {monthLabel(r.month).split(" ")[0]}
          </span>
        ))}
      </div>
      {threshold && (
        <p className="num mt-3 flex items-center gap-4 text-[11px] text-muted">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 bg-amber" /> up to {threshold}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="hatch inline-block h-2.5 w-2.5" /> above {threshold}
          </span>
        </p>
      )}
      <DataTable headers={["Month", `Usage (${unit})`, "Charges"]} rows={rows.map((r) => [monthLabel(r.month), String(r.usage), r.amount != null ? rm(r.amount) : "–"])} />
    </figure>
  );
}

const CATEGORIES = [
  { key: "electricity", name: "Electricity", color: "var(--amber)" },
  { key: "water", name: "Water", color: "var(--blue)" },
  { key: "telco", name: "Telco", color: "var(--green)" },
] as const;

export type SpendRow = { month: string; electricity?: number; water?: number; telco?: number };

/** Monthly spend stacked by category. Colour follows the category, never its rank. */
export function SpendChart({ data }: { data: SpendRow[] }) {
  const present = CATEGORIES.filter((c) => data.some((d) => d[c.key] != null));
  const totals = data.map((d) => present.reduce((s, c) => s + (d[c.key] ?? 0), 0));
  const [sel, setSel] = useState(data.length - 1);
  if (!data.length) return null;
  const max = niceMax(Math.max(...totals));
  const cur = data[Math.min(sel, data.length - 1)];

  return (
    <figure>
      <figcaption className="num mb-3 flex flex-wrap items-baseline gap-x-4 gap-y-1 text-sm" aria-live="polite">
        <span className="text-muted">{monthLabel(cur.month).toUpperCase()}</span>
        {present.map((c) => (
          <span key={c.key} className="flex items-center gap-1.5 text-ink-2">
            <span className="inline-block h-2 w-2" style={{ background: c.color }} />
            {c.name} <span className="text-ink">{cur[c.key] != null ? rm(cur[c.key]!) : "–"}</span>
          </span>
        ))}
      </figcaption>
      <div className="relative flex h-40 items-end justify-around gap-[4%] border-b border-line-2 px-[3%] sm:h-48">
        {data.map((d, i) => (
          <button
            key={d.month}
            type="button"
            aria-label={`${monthLabel(d.month)}: ${rm(totals[i])}`}
            onMouseEnter={() => setSel(i)}
            onFocus={() => setSel(i)}
            onClick={() => setSel(i)}
            className={`flex max-w-12 flex-1 flex-col-reverse gap-[2px] ${i === sel ? "" : "opacity-75"}`}
            style={{ height: `${(totals[i] / max) * 100}%` }}
          >
            {present.map((c, j) =>
              d[c.key] ? (
                <span
                  key={c.key}
                  className={j === present.length - 1 ? "rounded-t-[3px]" : ""}
                  style={{ background: c.color, flexGrow: d[c.key], flexBasis: 0 }}
                />
              ) : null,
            )}
          </button>
        ))}
      </div>
      <div className="flex justify-around gap-[4%] px-[3%] pt-1.5">
        {data.map((d, i) => (
          <span key={d.month} className={`num max-w-12 flex-1 text-center text-[10px] ${i === sel ? "text-ink" : "text-muted"}`}>
            {monthLabel(d.month).split(" ")[0]}
          </span>
        ))}
      </div>
      <DataTable
        headers={["Month", ...present.map((c) => c.name)]}
        rows={data.map((r) => [monthLabel(r.month), ...present.map((c) => (r[c.key] != null ? rm(r[c.key]!) : "–"))])}
      />
    </figure>
  );
}

function DataTable({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <details className="mt-3">
      <summary className="label cursor-pointer select-none hover:text-ink-2">Table view</summary>
      <div className="mt-2 overflow-x-auto">
        <table className="num w-full text-left text-xs">
          <thead className="text-muted">
            <tr>{headers.map((h) => <th key={h} className="py-1 pr-4 font-normal">{h}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r[0]} className="border-t border-line">
                {r.map((c, i) => <td key={i} className="py-1 pr-4">{c}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
