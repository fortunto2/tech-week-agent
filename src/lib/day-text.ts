// The day as text, the same shape day_script.py prints (`## 0505 · 01.10 21:14 · ru · 26s`, then numbered
// sentences). It is what the director reads to write a script, so the numbers must match `sentences.idx`.
import { asc, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/db";

const PT = "America/Los_Angeles";

function fmtTime(d: Date | null): string {
  if (!d) return "??.?? ??:??";
  const p = new Intl.DateTimeFormat("en-GB", { timeZone: PT, day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(d);
  const g = (t: string) => p.find((x) => x.type === t)?.value ?? "??";
  return `${g("day")}.${g("month")} ${g("hour")}:${g("minute")}`;
}

export type DaySummary = {
  dayId: number;
  title: string;
  folder: string;
  clips: number;
  withSpeech: number;
  languages: Record<string, number>;
  shotFrom: string | null;
  shotTo: string | null;
  totalMinutes: number;
};

export async function daySummary(dayId: number): Promise<DaySummary | null> {
  const day = await db.query.days.findFirst({ where: eq(schema.days.id, dayId) });
  if (!day) return null;
  const cs = await db.select().from(schema.clips).where(eq(schema.clips.dayId, dayId));
  const languages: Record<string, number> = {};
  let withSpeech = 0;
  let total = 0;
  for (const c of cs) {
    total += c.durationSecs ?? 0;
    if (c.language) {
      withSpeech++;
      languages[c.language] = (languages[c.language] ?? 0) + 1;
    }
  }
  return {
    dayId,
    title: day.title,
    folder: day.folder,
    clips: cs.length,
    withSpeech,
    languages,
    shotFrom: day.shotFrom?.toISOString() ?? null,
    shotTo: day.shotTo?.toISOString() ?? null,
    totalMinutes: Math.round(total / 60),
  };
}

/** Full day text. ~1 KB per talking clip; a 160-clip week is ~150 KB, which the director model takes in one call. */
export async function dayText(dayId: number, opts: { maxChars?: number } = {}): Promise<{ text: string; truncated: boolean }> {
  const cs = await db.select().from(schema.clips).where(eq(schema.clips.dayId, dayId)).orderBy(asc(schema.clips.shotAt), asc(schema.clips.file));
  const ids = cs.map((c) => c.id);
  const ss = ids.length
    ? await db.select().from(schema.sentences).where(inArray(schema.sentences.clipId, ids)).orderBy(asc(schema.sentences.clipId), asc(schema.sentences.idx))
    : [];
  const byClip = new Map<number, typeof ss>();
  for (const s of ss) byClip.set(s.clipId, [...(byClip.get(s.clipId) ?? []), s]);

  const parts: string[] = [];
  for (const c of cs) {
    const sent = byClip.get(c.id) ?? [];
    const head = `## ${c.tag} · ${fmtTime(c.shotAt)} · ${c.language ?? "silent"} · ${Math.round(c.durationSecs ?? 0)}s`;
    if (!sent.length) {
      parts.push(`${head} · picture ${Math.round((c.overallScore ?? 0) * 100)}%`);
      continue;
    }
    parts.push(head, ...sent.map((s) => `${String(s.idx).padStart(3)} [${s.startSecs.toFixed(1).padStart(6)}] ${s.text}`), "");
  }
  let text = parts.join("\n");
  const max = opts.maxChars ?? 400_000;
  const truncated = text.length > max;
  if (truncated) text = text.slice(0, max) + "\n…(truncated)";
  return { text, truncated };
}

/** Which clip tags and sentence counts exist, so a script can be validated before it is saved. */
export async function dayIndex(dayId: number): Promise<Map<string, { sentences: number; durationSecs: number }>> {
  const cs = await db.select().from(schema.clips).where(eq(schema.clips.dayId, dayId));
  const ids = cs.map((c) => c.id);
  const counts = new Map<number, number>();
  if (ids.length) {
    const ss = await db.select({ clipId: schema.sentences.clipId }).from(schema.sentences).where(inArray(schema.sentences.clipId, ids));
    for (const s of ss) counts.set(s.clipId, (counts.get(s.clipId) ?? 0) + 1);
  }
  const out = new Map<string, { sentences: number; durationSecs: number }>();
  for (const c of cs) out.set(c.tag, { sentences: counts.get(c.id) ?? 0, durationSecs: c.durationSecs ?? 0 });
  return out;
}
