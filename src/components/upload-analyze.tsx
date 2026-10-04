"use client";
// Drop a clip, watch the analysis happen: frame scores arrive one by one from the life2film engine,
// shots are found, whisper lines appear, the vision caption lands, embeddings are written. Nothing here is
// animated for show; every number is an event from /api/analyze.
import { useRef, useState } from "react";

type Frame = { t: number; score: number; isGarbage: boolean; sharpness: number; colorfulness: number; brightness: number; stability: number };
type Shot = { startSecs: number; endSecs: number; score: number; bestFrameTs: number };
type Line = { idx: number; text: string; start: number; end: number };
type Done = { tag: string; durationSecs: number; language: string | null; sentences: number; moments: number; caption: string | null; dayId: number };

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
  const inputRef = useRef<HTMLInputElement>(null);

  async function run(file: File) {
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
          const ev = JSON.parse(line);
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
          {st.file ? st.file : "a phone or DJI clip → scored, transcribed, captioned, searchable"}
          {st.meta && ` · ${Math.round(st.meta.durationSecs)} s · ${st.meta.width}×${st.meta.height} · ${st.meta.fps.toFixed(0)} fps`}
        </span>
      </div>
      {(st.frames.length > 0 || st.whisper) && (
        <div className="mt-2 grid gap-2 md:grid-cols-[1fr_220px]">
          <div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>frame quality · life2film engine, 2 fps, 31 measurements/frame</span>
              <span>{st.frames.length} frames{st.shots.length ? ` · ${st.shots.length} shots` : ""}</span>
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
              {st.done && <div className="text-xs font-medium text-emerald-600">clip {st.done.tag} ingested · ask the director about it</div>}
              {st.error && <div className="text-xs text-destructive">{st.error}</div>}
            </div>
          </div>
          <div className="space-y-1.5">
            <Meter label="sharpness" value={avg("sharpness")} />
            <Meter label="colourfulness" value={avg("colorfulness")} />
            <Meter label="brightness" value={avg("brightness")} />
            <Meter label="stability" value={avg("stability")} />
            <Meter label="quality (mean)" value={avg("score")} />
          </div>
        </div>
      )}
    </div>
  );
}
