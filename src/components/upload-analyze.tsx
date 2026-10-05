"use client";
// Drop a clip, watch the analysis happen: frame scores arrive one by one from the life2film engine,
// shots are found, whisper lines appear, the vision caption lands, embeddings are written. Nothing here is
// animated for show; every number is an event from /api/analyze.
import { useEffect, useRef, useState } from "react";
import type { IngestedClip, Progress } from "@/lib/ingest-clip";
import { analyzeInBrowser } from "@/lib/browser-analyze";

// Hosted deploys (no ffmpeg/whisper on the server) analyse in the browser with the same WASM engine and
// send only scores, shots and one best frame. The Mac build streams the full server-side pipeline.
const BROWSER_MODE = process.env.NEXT_PUBLIC_LOCAL_TOOLS === "0";
const MAX_BROWSER_CLIPS = 3;

type Frame = Extract<Progress, { stage: "frame" }>;
type Shot = Extract<Progress, { stage: "shots" }>["shots"][number];
type Line = NonNullable<Extract<Progress, { stage: "whisper" }>["sentences"]>[number];
type Done = IngestedClip;
type Event = Progress | { stage: "error"; message: string };

type State = {
  file?: string;
  meta?: { durationSecs: number; width: number; height: number; fps: number; hasAudio: boolean };
  frames: Frame[];
  shots: Shot[];
  whisper?: "start" | "done";
  language?: string | null;
  lines: Line[];
  caption?: string | null;
  embeddings?: number;
  done?: Done;
  error?: string;
};

const empty: State = { frames: [], shots: [], lines: [] };

function Sparkline({ frames, duration }: { frames: Frame[]; duration: number }) {
  const w = 600, h = 56;
  if (!frames.length) return <svg width="100%" viewBox={`0 0 ${w} ${h}`} className="h-14 w-full" />;
  const x = (t: number) => (t / Math.max(duration, frames[frames.length - 1].t + 0.5)) * w;
  const pts = frames.map((f) => `${x(f.t).toFixed(1)},${(h - 4 - f.score * (h - 8)).toFixed(1)}`).join(" ");
  const best = frames.reduce((m, f) => (f.score > m.score ? f : m), frames[0]);
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-14 w-full">
      <polyline points={pts} fill="none" stroke="currentColor" strokeWidth="1.5" className="text-emerald-500" />
      {frames.filter((f) => f.isGarbage).map((f, i) => (
        <rect key={i} x={x(f.t) - 1} y={0} width={2} height={h} className="fill-red-500/40" />
      ))}
      <circle cx={x(best.t)} cy={h - 4 - best.score * (h - 8)} r={3} className="fill-amber-400" />
    </svg>
  );
}

/** The frames exactly as the engine saw them (128 px RGB24), drawn as they arrive; border = quality, red = garbage. */
function FrameTile({ f }: { f: Frame }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c || !f.rgb || !f.w || !f.h) return;
    const bin = atob(f.rgb);
    const img = new ImageData(f.w, f.h);
    for (let i = 0, j = 0; i < bin.length; i += 3, j += 4) {
      img.data[j] = bin.charCodeAt(i);
      img.data[j + 1] = bin.charCodeAt(i + 1);
      img.data[j + 2] = bin.charCodeAt(i + 2);
      img.data[j + 3] = 255;
    }
    c.getContext("2d")?.putImageData(img, 0, 0);
  }, [f]);
  const border = f.isGarbage ? "#ef4444" : `hsl(${Math.round(f.score * 120)} 70% 45%)`;
  return (
    <div className="shrink-0" title={`${f.t.toFixed(1)}s · ${Math.round(f.score * 100)}%`}>
      <canvas ref={ref} width={f.w ?? 128} height={f.h ?? 72} style={{ width: 96, height: 54, borderBottom: `3px solid ${border}` }} className="block rounded-sm bg-muted" />
    </div>
  );
}

function Meter({ label, value }: { label: string; value: number }) {
  return (
    <div className="text-xs">
      <div className="flex justify-between text-muted-foreground"><span>{label}</span><span>{Math.round(value * 100)}%</span></div>
      <div className="mt-0.5 h-1.5 w-full rounded bg-muted"><div className="h-1.5 rounded bg-sky-500" style={{ width: `${Math.round(value * 100)}%` }} /></div>
    </div>
  );
}

export function UploadAnalyze() {
  const [st, setSt] = useState<State>(empty);
  const [busy, setBusy] = useState(false);
  const [doneCount, setDoneCount] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  async function runInBrowser(file: File) {
    if (doneCount >= MAX_BROWSER_CLIPS) {
      setSt({ ...empty, file: file.name, error: `hosted demo: up to ${MAX_BROWSER_CLIPS} clips per visit` });
      return;
    }
    setBusy(true);
    setSt({ ...empty, file: file.name });
    try {
      const apply = (ev: Progress) =>
        setSt((s) => {
          switch (ev.stage) {
            case "probe": return { ...s, meta: ev };
            case "frame": return { ...s, frames: [...s.frames, ev] };
            case "shots": return { ...s, shots: ev.shots };
            default: return s;
          }
        });
      const result = await analyzeInBrowser(file, apply);
      const res = await fetch("/api/analyze-client", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(result) });
      if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
      const done = (await res.json()) as Done;
      setSt((s) => ({ ...s, caption: done.caption, embeddings: done.caption ? 1 : 0, done }));
      setDoneCount((n) => n + 1);
    } catch (e) {
      setSt((s) => ({ ...s, error: e instanceof Error ? e.message : String(e) }));
    } finally {
      setBusy(false);
    }
  }

  async function run(file: File) {
    if (BROWSER_MODE) return runInBrowser(file);
    setBusy(true);
    setSt({ ...empty, file: file.name });
    const fd = new FormData();
    fd.append("file", file);
    try {
      const res = await fetch("/api/analyze", { method: "POST", body: fd });
      if (!res.ok || !res.body) throw new Error(`upload failed: ${res.status}`);
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const ev = JSON.parse(line) as Event;
          setSt((s) => {
            switch (ev.stage) {
              case "probe": return { ...s, meta: ev };
              case "frame": return { ...s, frames: [...s.frames, ev] };
              case "shots": return { ...s, shots: ev.shots };
              case "whisper": return { ...s, whisper: ev.status, language: ev.language ?? s.language, lines: ev.sentences ?? s.lines };
              case "caption": return { ...s, caption: ev.caption };
              case "embeddings": return { ...s, embeddings: ev.count };
              case "done": return { ...s, done: ev.clip };
              case "error": return { ...s, error: ev.message };
              default: return s;
            }
          });
        }
      }
    } catch (e) {
      setSt((s) => ({ ...s, error: e instanceof Error ? e.message : String(e) }));
    } finally {
      setBusy(false);
    }
  }

  const avg = (k: keyof Frame) => (st.frames.length ? st.frames.reduce((a, f) => a + (f[k] as number), 0) / st.frames.length : 0);
  const dur = st.meta?.durationSecs ?? 0;

  return (
    <div className="border-b border-border px-4 py-2 text-sm">
      <div className="flex items-center gap-3">
        <input ref={inputRef} type="file" accept="video/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void run(f); e.currentTarget.value = ""; }} />
        <button type="button" disabled={busy} onClick={() => inputRef.current?.click()} className="rounded-lg bg-foreground px-3 py-1.5 text-xs font-medium text-background disabled:opacity-50">
          {busy ? "Analysing…" : "Upload a clip"}
        </button>
        <span className="text-xs text-muted-foreground">
          {st.file ? st.file : BROWSER_MODE ? `a phone or DJI clip → scored in your browser (WASM), captioned, searchable · nothing is uploaded · ${MAX_BROWSER_CLIPS} clips per visit` : "a phone or DJI clip → scored, transcribed, captioned, searchable"}
          {st.meta && ` · ${Math.round(st.meta.durationSecs)} s · ${st.meta.width}×${st.meta.height} · ${st.meta.fps.toFixed(0)} fps`}
        </span>
      </div>
      {st.error && <div className="mt-1 text-xs text-destructive">{st.error}</div>}
      {(st.frames.length > 0 || st.whisper) && (
        <div className="mt-2 grid gap-2 md:grid-cols-[minmax(0,1fr)_220px]">
          <div className="min-w-0">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>frame quality · life2film engine{BROWSER_MODE ? " in your browser" : ""}, 2 fps, 31 measurements/frame</span>
              <span>{st.frames.length} frames{st.shots.length ? ` · ${st.shots.length} shots` : ""}</span>
            </div>
            <div className="mt-1 flex gap-1 overflow-x-auto pb-1" ref={(el) => { if (el) el.scrollLeft = el.scrollWidth; }}>
              {st.frames.slice(-40).map((f) => <FrameTile key={f.t} f={f} />)}
            </div>
            <Sparkline frames={st.frames} duration={dur} />
            {st.shots.length > 0 && (
              <div className="mt-1 flex h-3 w-full overflow-hidden rounded bg-muted">
                {st.shots.map((sh, i) => (
                  <div key={i} title={`${sh.startSecs.toFixed(1)}–${sh.endSecs.toFixed(1)}s · ${Math.round(sh.score * 100)}%`} style={{ width: `${((sh.endSecs - sh.startSecs) / Math.max(dur, 1)) * 100}%`, opacity: 0.35 + sh.score * 0.65 }} className="border-r border-background bg-emerald-500" />
                ))}
              </div>
            )}
            <div className="mt-2 space-y-0.5">
              {st.whisper === "start" && st.lines.length === 0 && <div className="animate-pulse text-xs text-muted-foreground">whisper: transcribing…</div>}
              {st.lines.slice(0, 6).map((l) => (
                <div key={l.idx} className="flex gap-2 text-xs"><span className="w-10 shrink-0 font-mono text-muted-foreground">{l.start.toFixed(1)}s</span><span>{l.text}</span></div>
              ))}
              {st.lines.length > 6 && <div className="text-xs text-muted-foreground">… {st.lines.length} lines, {st.language}</div>}
              {st.caption && <div className="text-xs"><span className="text-muted-foreground">camera saw: </span>{st.caption}</div>}
              {st.embeddings !== undefined && <div className="text-xs text-muted-foreground">embeddings written: {st.embeddings} → Neon</div>}
              {st.done && <div className="text-xs font-medium text-emerald-600">clip {st.done.tag} ingested · ask the director about it{BROWSER_MODE ? " (speech and renders need the Mac build)" : ""}</div>}
            </div>
          </div>
          <div className="space-y-1.5">
            <Meter label="sharpness" value={avg("sharpness")} />
            <Meter label="colourfulness" value={avg("colorfulness")} />
            <Meter label="brightness" value={avg("brightness")} />
            <Meter label="motion" value={avg("motion")} />
            <Meter label="quality (mean)" value={avg("score")} />
          </div>
        </div>
      )}
    </div>
  );
}
