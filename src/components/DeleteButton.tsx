"use client";

import { useState, useTransition } from "react";

export function DeleteButton({ action }: { action: () => Promise<void> }) {
  const [confirming, setConfirming] = useState(false);
  const [pending, start] = useTransition();

  if (!confirming) {
    return (
      <button onClick={() => setConfirming(true)} className="num text-xs tracking-wider text-muted uppercase hover:text-red">
        Delete bill
      </button>
    );
  }
  return (
    <div className="num flex items-center gap-3 text-xs tracking-wider uppercase">
      <span className="text-ink-2">Delete this bill and its PDF?</span>
      <button onClick={() => setConfirming(false)} className="text-muted hover:text-ink">
        Cancel
      </button>
      <button disabled={pending} onClick={() => start(action)} className="border border-red px-2 py-1 text-red disabled:opacity-50">
        {pending ? "Deleting…" : "Delete"}
      </button>
    </div>
  );
}
