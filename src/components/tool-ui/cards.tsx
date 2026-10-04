"use client";
// Generative UI cards for the director's tools. Each takes the tool's result shape; all handle "no result yet".

type DaySummary = { dayId: number; title: string; clips: number; withSpeech: number; languages: Record<string, number>; shotFrom: string | null; shotTo: string | null; totalMinutes: number };

const fmtDay = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", timeZone: "America/Los_Angeles" }) : "?");

export function DaysCard({ days }: { days: DaySummary[] }) {
  return (
    <div className="my-2 grid gap-2">
      {days.map((d) => (
        <div key={d.dayId} className="rounded-xl border border-border bg-card p-3 text-sm">
          <div className="flex items-baseline justify-between">
            <span className="font-medium">{d.title}</span>
            <span className="text-muted-foreground">
              {fmtDay(d.shotFrom)}–{fmtDay(d.shotTo)}
            </span>
          </div>
          <div className="mt-1 text-muted-foreground">
            {d.clips} clips · {d.totalMinutes} min · {d.withSpeech} with speech ·{" "}
            {Object.entries(d.languages)
              .map(([l, n]) => `${l} ${n}`)
              .join(", ")}
          </div>
        </div>
      ))}
    </div>
  );
}

type Shot = { clip: string; say?: [number, number]; show?: number; walk?: number; len?: number; note?: string };
type ScriptResult = { scriptId: number; version: number; about: string; shots: number; sayLines: number; walks: number; openFrames: number; problems: string[]; script: { _: string; open?: { shots: { clip: string; at: number; len: number }[] }; shots: Shot[] } };

export function ScriptCard({ r }: { r: ScriptResult }) {
  return (
    <div className="my-2 rounded-xl border border-border bg-card p-3 text-sm">
      <div className="flex items-baseline justify-between">
        <span className="font-medium">Script v{r.version}</span>
        <span className="text-muted-foreground">
          {r.sayLines} lines · {r.walks} walks · {r.openFrames} open frames
        </span>
      </div>
      <p className="mt-1 italic text-muted-foreground">{r.about}</p>
      {r.script.open && (
        <div className="mt-2 flex flex-wrap gap-1">
          {r.script.open.shots.map((o, i) => (
            <span key={i} className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
              {o.clip}@{o.at}s
            </span>
          ))}
        </div>
      )}
      <ol className="mt-2 max-h-72 space-y-1 overflow-y-auto">
        {r.script.shots.map((s, i) => (
          <li key={i} className="flex gap-2">
            <span className="w-5 shrink-0 text-right text-muted-foreground">{i + 1}</span>
            <span className={`shrink-0 rounded px-1 font-mono text-xs ${s.say ? "bg-emerald-500/15" : s.walk !== undefined ? "bg-sky-500/15" : "bg-amber-500/15"}`}>
              {s.clip} {s.say ? `say ${s.say[0]}–${s.say[1]}` : s.walk !== undefined ? `walk ${s.walk}s+${s.len ?? ""}` : `show ${s.show}s+${s.len ?? ""}`}
            </span>
            <span className="truncate">{s.note}</span>
          </li>
        ))}
      </ol>
      {r.problems.length > 0 && (
        <ul className="mt-2 list-disc pl-5 text-xs text-destructive">
          {r.problems.map((p, i) => (
            <li key={i}>{p}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function RenderCard({ r }: { r: { status: string; mediaUrl: string | null; durationSecs: number | null; log: string } }) {
  if (r.status !== "done" || !r.mediaUrl)
    return (
      <div className="my-2 rounded-xl border border-destructive/40 bg-card p-3 text-sm">
        <div className="font-medium">Render {r.status}</div>
        <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap text-xs text-muted-foreground">{r.log}</pre>
      </div>
    );
  return (
    <div className="my-2 overflow-hidden rounded-xl border border-border bg-black">
      <video src={r.mediaUrl} controls playsInline className="aspect-video w-full" />
      <div className="px-3 py-1 text-xs text-muted-foreground">{r.durationSecs ? `${Math.round(r.durationSecs)} s` : ""}</div>
    </div>
  );
}

export function RuleCard({ r }: { r: { category: string; text: string; quote: string } }) {
  return (
    <div className="my-2 rounded-xl border border-emerald-500/40 bg-card p-3 text-sm">
      <div className="text-xs uppercase tracking-wide text-emerald-600">rule learned · {r.category}</div>
      <div className="mt-1 font-medium">{r.text}</div>
      <div className="mt-1 text-muted-foreground">«{r.quote}»</div>
    </div>
  );
}

export function RulesCard({ rules }: { rules: { id: number; category: string; text: string }[] }) {
  return (
    <div className="my-2 rounded-xl border border-border bg-card p-3 text-sm">
      <div className="font-medium">{rules.length} standing rules</div>
      <ul className="mt-1 space-y-1">
        {rules.map((r) => (
          <li key={r.id} className="flex gap-2">
            <span className="shrink-0 rounded bg-muted px-1 font-mono text-xs">{r.category}</span>
            <span>{r.text}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

type Hit = { clipTag: string; dayTitle: string; idx: number; text: string; startSecs: number; shotAt: string | null; language: string | null; via: string };
type Pic = { clipTag: string; startSecs: number; caption: string };
export function SearchCard({ r }: { r: { query: string; hits: Hit[]; pictures?: Pic[] } }) {
  const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "America/Los_Angeles" }) : "");
  return (
    <div className="my-2 rounded-xl border border-border bg-card p-3 text-sm">
      <div className="font-medium">
        «{r.query}» · {r.hits.length} moments
      </div>
      <ol className="mt-2 space-y-1.5">
        {r.hits.map((h, i) => (
          <li key={i} className="flex gap-2">
            <span className="shrink-0 rounded bg-muted px-1 font-mono text-xs">
              {h.clipTag} @{Math.round(h.startSecs)}s
            </span>
            <span className="min-w-0">
              <span>{h.text}</span>
              <span className="ml-1 text-xs text-muted-foreground">
                {fmt(h.shotAt)} · {h.language} · {h.via}
              </span>
            </span>
          </li>
        ))}
      </ol>
      {r.pictures && r.pictures.length > 0 && (
        <>
          <div className="mt-3 text-xs uppercase tracking-wide text-muted-foreground">what the camera saw</div>
          <ul className="mt-1 space-y-1">
            {r.pictures.map((p, i) => (
              <li key={i} className="flex gap-2">
                <span className="shrink-0 rounded bg-amber-500/15 px-1 font-mono text-xs">
                  {p.clipTag} @{Math.round(p.startSecs)}s
                </span>
                <span className="text-muted-foreground">{p.caption}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

type Ingested = { from: string; subject: string; file: string; tag: string; durationSecs: number; language: string | null; sentences: number; moments: number; caption: string | null; firstWords: string | null };
export function InboxCard({ r }: { r: { inbox: string; checked: number; ingested: Ingested[]; skipped: string[] } }) {
  return (
    <div className="my-2 rounded-xl border border-border bg-card p-3 text-sm">
      <div className="flex items-baseline justify-between">
        <span className="font-medium">{r.inbox}</span>
        <span className="text-muted-foreground">{r.checked} messages · {r.ingested.length} clips ingested</span>
      </div>
      <ul className="mt-2 space-y-2">
        {r.ingested.map((c, i) => (
          <li key={i} className="rounded-lg bg-muted/50 p-2">
            <div className="flex gap-2">
              <span className="shrink-0 rounded bg-emerald-500/15 px-1 font-mono text-xs">{c.tag}</span>
              <span className="truncate">{c.file}</span>
              <span className="ml-auto shrink-0 text-xs text-muted-foreground">{Math.round(c.durationSecs)} s · {c.language ?? "silent"} · {c.sentences} lines · {c.moments} shots</span>
            </div>
            {c.firstWords && <div className="mt-1">«{c.firstWords}…»</div>}
            {c.caption && <div className="mt-0.5 text-xs text-muted-foreground">{c.caption}</div>}
          </li>
        ))}
      </ul>
      {r.skipped.length > 0 && <div className="mt-2 text-xs text-muted-foreground">skipped: {r.skipped.join("; ")}</div>}
    </div>
  );
}

type RenderRow = { renderId: number; version: number; dayTitle: string; about: string; status: string; durationSecs: number | null; mediaUrl: string | null };
export function RendersCard({ renders }: { renders: RenderRow[] }) {
  return (
    <div className="my-2 grid gap-2">
      {renders.map((r) => (
        <div key={r.renderId} className="overflow-hidden rounded-xl border border-border bg-card text-sm">
          {r.mediaUrl && <video src={r.mediaUrl} controls preload="metadata" playsInline className="aspect-video w-full bg-black" />}
          <div className="p-3">
            <div className="flex items-baseline justify-between">
              <span className="font-medium">{r.dayTitle} · v{r.version}</span>
              <span className="text-muted-foreground">{r.durationSecs ? `${Math.floor(r.durationSecs / 60)}:${String(Math.round(r.durationSecs % 60)).padStart(2, "0")}` : r.status}</span>
            </div>
            <p className="mt-1 italic text-muted-foreground">{r.about}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

export function DescriptionCard({ r }: { r: { title: string; description: string; chapters: { at: string; name: string }[]; tags: string[]; facts: { title: string; url: string }[] } }) {
  return (
    <div className="my-2 rounded-xl border border-border bg-card p-3 text-sm">
      <div className="text-base font-semibold">{r.title}</div>
      <p className="mt-1 whitespace-pre-line text-muted-foreground">{r.description}</p>
      <ul className="mt-2 space-y-0.5">
        {r.chapters.map((c, i) => (
          <li key={i} className="flex gap-2">
            <span className="w-10 shrink-0 font-mono text-xs text-muted-foreground">{c.at}</span>
            <span>{c.name}</span>
          </li>
        ))}
      </ul>
      <div className="mt-2 flex flex-wrap gap-1">
        {r.tags.map((t) => (
          <span key={t} className="rounded bg-muted px-1.5 py-0.5 text-xs">#{t}</span>
        ))}
      </div>
      {r.facts.length > 0 && (
        <div className="mt-2 text-xs text-muted-foreground">
          facts via Exa: {r.facts.map((f, i) => (<a key={i} href={f.url} target="_blank" rel="noreferrer" className="underline mr-2">{f.title || f.url}</a>))}
        </div>
      )}
    </div>
  );
}
