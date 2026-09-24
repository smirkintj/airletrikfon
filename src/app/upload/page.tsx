"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type Item = { key: string; file: File; state: "queued" | "reading" | "done" | "duplicate" | "error"; id?: string; error?: string; startedAt?: number };

export default function UploadPage() {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [over, setOver] = useState(false);
  const [now, setNow] = useState(0);
  const busy = items.some((i) => i.state === "reading" || i.state === "queued");

  // Elapsed-seconds counter while a bill is being read.
  useEffect(() => {
    if (!busy) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [busy]);

  const update = (key: string, patch: Partial<Item>) => setItems((list) => list.map((i) => (i.key === key ? { ...i, ...patch } : i)));

  async function add(files: FileList | File[]) {
    const fresh = [...files].map((file) => ({ key: `${file.name}-${file.size}-${crypto.randomUUID()}`, file, state: "queued" as const }));
    if (!fresh.length) return;
    setItems((list) => [...fresh, ...list]);
    // One at a time keeps the order predictable and avoids piling up long requests.
    for (const it of fresh) {
      if (it.file.type !== "application/pdf") {
        update(it.key, { state: "error", error: "Not a PDF" });
        continue;
      }
      update(it.key, { state: "reading", startedAt: Date.now() });
      const form = new FormData();
      form.set("file", it.file);
      try {
        const res = await fetch("/api/bills", { method: "POST", body: form });
        const body = await res.json().catch(() => ({ error: "Upload failed" }));
        update(it.key, res.ok ? { state: body.duplicate ? "duplicate" : "done", id: body.id } : { state: "error", error: body.error });
      } catch {
        update(it.key, { state: "error", error: "Network error, try again" });
      }
    }
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <p className="label">02 · Add bill</p>
        <h1 className="mt-1 text-2xl font-medium">Drop in your e-bills</h1>
        <p className="mt-1 text-sm text-ink-2">TNB, Air Selangor, Maxis or CelcomDigi PDFs. Several at once is fine.</p>
      </div>

      <button
        type="button"
        onClick={() => input.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          add(e.dataTransfer.files);
        }}
        className={`flex w-full flex-col items-center justify-center gap-2 border border-dashed px-4 py-12 text-center transition-colors sm:py-16 ${
          over ? "border-amber bg-panel-2" : "border-line-2 bg-panel hover:border-ink-2"
        }`}
      >
        <span className="num text-3xl text-amber-ink" aria-hidden>
          +
        </span>
        <span className="font-medium">
          <span className="underline decoration-line-2 underline-offset-4 sm:hidden">Choose files</span>
          <span className="hidden sm:inline">
            Drop PDFs here or <span className="underline decoration-line-2 underline-offset-4">choose files</span>
          </span>
        </span>
        <span className="label">PDF · up to 10 MB each</span>
      </button>
      <input
        ref={input}
        type="file"
        accept="application/pdf"
        multiple
        hidden
        onChange={(e) => {
          if (e.target.files) add(e.target.files);
          e.target.value = "";
        }}
      />

      {items.length > 0 && (
        <ul className="divide-y divide-line border border-line bg-panel" aria-live="polite">
          {items.map((i) => (
            <li key={i.key} className="flex items-center gap-3 px-4 py-3 text-sm">
              <Status item={i} />
              <span className="min-w-0 flex-1 truncate">{i.file.name}</span>
              <span className="num shrink-0 text-xs text-muted">
                {i.state === "reading" && i.startedAt ? `${Math.max(0, Math.floor((now - i.startedAt) / 1000))}s` : `${Math.max(1, Math.round(i.file.size / 1024))} KB`}
              </span>
              {(i.state === "done" || i.state === "duplicate") && i.id && (
                <Link href={`/bills/${i.id}`} className="num shrink-0 text-xs tracking-wider text-amber-ink uppercase">
                  Open →
                </Link>
              )}
            </li>
          ))}
        </ul>
      )}
      {items.some((i) => i.state === "error") && (
        <ul className="space-y-1 text-sm text-red" role="alert">
          {items.filter((i) => i.state === "error").map((i) => (
            <li key={i.key}>
              {i.file.name}: {i.error}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Status({ item }: { item: Item }) {
  const map = {
    queued: ["Queued", "border-line-2 text-muted"],
    reading: ["Reading", "border-amber text-amber-ink animate-pulse"],
    done: ["Saved", "border-ok text-ok"],
    duplicate: ["Exists", "border-line-2 text-ink-2"],
    error: ["Failed", "border-red text-red"],
  } as const;
  const [text, cls] = map[item.state];
  return <span className={`num w-16 shrink-0 border px-1.5 py-px text-center text-[10px] tracking-widest uppercase ${cls}`}>{text}</span>;
}
