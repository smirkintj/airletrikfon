"use client";

import { useEffect, useRef, useState } from "react";

const EXAMPLES = ["Why did my electricity go up?", "What would 550 kWh a month cost me?", "Which bill grew the most this year?"];

type Turn = { q: string; a?: string; error?: string };

export default function AskPage() {
  const [question, setQuestion] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [startedAt, setStartedAt] = useState(0);
  const [now, setNow] = useState(0);
  const seconds = Math.max(0, Math.floor((now - startedAt) / 1000));
  const loading = turns.length > 0 && !turns[0].a && !turns[0].error;
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!loading) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [loading]);

  async function ask(q: string) {
    if (!q.trim() || loading) return;
    setQuestion("");
    setStartedAt(Date.now());
    setNow(Date.now());
    setTurns((t) => [{ q }, ...t]);
    const done = (patch: Partial<Turn>) => setTurns((t) => [{ ...t[0], ...patch }, ...t.slice(1)]);
    try {
      const res = await fetch("/api/ask", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ question: q }) });
      const body = await res.json().catch(() => ({ error: "Request failed" }));
      done(res.ok ? { a: body.answer } : { error: body.error });
    } catch {
      done({ error: "Network error, try again" });
    }
    inputRef.current?.focus();
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <p className="label">03 · Ask</p>
        <h1 className="mt-1 text-2xl font-medium">Ask about your bills</h1>
        <p className="mt-1 text-sm text-ink-2">Answers come from the bills you&apos;ve added. TNB what-ifs use the tariff calculator.</p>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          ask(question);
        }}
        className="border border-line bg-panel focus-within:border-ink-2"
      >
        <textarea
          ref={inputRef}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              ask(question);
            }
          }}
          rows={2}
          maxLength={2000}
          placeholder="e.g. How much did aircon season cost me?"
          className="block w-full resize-none bg-transparent px-4 py-3 outline-none placeholder:text-muted"
        />
        <div className="flex items-center justify-between border-t border-line px-4 py-2">
          <span className="label hidden sm:inline">Enter to send · Shift+Enter for a new line</span>
          <button disabled={loading || !question.trim()} className="num ml-auto bg-amber px-3 py-1.5 text-xs font-medium tracking-wider text-black uppercase disabled:opacity-40">
            Ask
          </button>
        </div>
      </form>

      {!turns.length && (
        <div className="flex flex-wrap gap-2">
          {EXAMPLES.map((q) => (
            <button key={q} onClick={() => ask(q)} className="border border-line px-3 py-1.5 text-left text-sm text-ink-2 hover:border-ink-2 hover:text-ink">
              {q}
            </button>
          ))}
        </div>
      )}

      <ol className="space-y-4" aria-live="polite">
        {turns.map((t, i) => (
          <li key={turns.length - i} className="border border-line bg-panel">
            <p className="border-b border-line px-4 py-2.5 text-sm text-ink-2">
              <span className="num mr-2 text-muted">Q</span>
              {t.q}
            </p>
            <div className="px-4 py-3">
              {t.a ? (
                <Answer text={t.a} />
              ) : t.error ? (
                <p className="text-sm text-red">{t.error}</p>
              ) : (
                <p className="num text-sm text-muted">
                  Working… <span className="text-amber-ink">{seconds}s</span>
                </p>
              )}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

/** Paragraphs, plus runs of "- " lines rendered as lists. Plain text only; nothing is parsed as HTML. */
function Answer({ text }: { text: string }) {
  const bullet = /^\s*[-•]\s+/;
  const groups: { list: boolean; lines: string[] }[] = [];
  for (const line of text.trim().split("\n")) {
    const list = bullet.test(line);
    const last = groups[groups.length - 1];
    if (!line.trim()) groups.push({ list: false, lines: [] });
    else if (last && last.list === list && (list || last.lines.length)) last.lines.push(line.replace(bullet, ""));
    else groups.push({ list, lines: [line.replace(bullet, "")] });
  }
  return (
    <div className="space-y-3">
      {groups
        .filter((g) => g.lines.length)
        .map((g, i) =>
          g.list ? (
            <ul key={i} className="space-y-1.5">
              {g.lines.map((l, j) => (
                <li key={j} className="flex gap-2">
                  <span className="num text-amber-ink">›</span>
                  <span>{l}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p key={i} className="whitespace-pre-wrap">
              {g.lines.join("\n")}
            </p>
          ),
        )}
    </div>
  );
}
