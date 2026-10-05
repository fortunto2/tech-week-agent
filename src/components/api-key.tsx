"use client";
// Bring your own OpenAI key for the hosted demo. Kept in localStorage, sent as the x-openai-key header with
// chat and analysis requests, never stored on the server.
import { useEffect, useState } from "react";

const STORAGE = "l2f.openaiKey";

export function getStoredKey(): string {
  try {
    return localStorage.getItem(STORAGE) ?? "";
  } catch {
    return "";
  }
}

export function ApiKeyField() {
  const [key, setKey] = useState("");
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setKey(getStoredKey()), 0); // after hydration; localStorage is browser-only
    return () => clearTimeout(t);
  }, []);
  const save = (v: string) => {
    setKey(v);
    try {
      if (v) localStorage.setItem(STORAGE, v);
      else localStorage.removeItem(STORAGE);
    } catch {
      /* private mode */
    }
  };
  return (
    <div className="flex items-center gap-2 text-xs">
      {open ? (
        <input
          autoFocus
          type="password"
          value={key}
          placeholder="sk-… OpenAI key (stays in your browser)"
          onChange={(e) => save(e.target.value)}
          onBlur={() => setOpen(false)}
          className="w-64 rounded-md border border-border bg-background px-2 py-1"
        />
      ) : (
        <button type="button" onClick={() => setOpen(true)} className={`rounded-md border px-2 py-1 ${key ? "border-emerald-500/50 text-emerald-600" : "border-amber-500/60 text-amber-600"}`}>
          {key ? "OpenAI key set" : "Add your OpenAI key"}
        </button>
      )}
    </div>
  );
}
