// Receives what the browser analysed (scores, shots, one best frame) — never the video — and makes it memory:
// a clip row, its shots, a vision caption of the best frame, an embedding. Small JSON only.
import { createOpenAI } from "@ai-sdk/openai";
import { embedMany, generateText } from "ai";
import { eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { clipTag } from "@/lib/sidecars";

export const maxDuration = 60;
const MAX_BODY = 2 * 1024 * 1024; // scores + one JPEG; a 10-minute clip is ~300 KB
const MAX_CLIPS_PER_DAY = 40; // hosted demo guard

type Body = {
  name: string;
  durationSecs: number;
  width: number;
  height: number;
  frames: { t: number; score: number; isGarbage: boolean }[];
  shots: { startSecs: number; endSecs: number; score: number; bestFrameTs: number; features: Record<string, number> }[];
  bestFrameJpeg: string;
};

export async function POST(req: Request) {
  const raw = await req.text();
  if (raw.length > MAX_BODY) return new Response("payload too large", { status: 413 });
  let body: Body;
  try {
    body = JSON.parse(raw) as Body;
  } catch {
    return new Response("bad json", { status: 400 });
  }
  if (!body?.name || !Number.isFinite(body.durationSecs) || !Array.isArray(body.shots) || !body.bestFrameJpeg?.startsWith("data:image/jpeg;base64,")) return new Response("bad payload", { status: 400 });

  const d = new Date();
  const folder = `browser://${d.toISOString().slice(0, 10)}`;
  const [day] = await db.insert(schema.days).values({ folder, title: `Browser uploads ${d.toISOString().slice(0, 10)}` }).onConflictDoUpdate({ target: schema.days.folder, set: { folder } }).returning();
  const count = await db.select({ n: sql<number>`count(*)::int` }).from(schema.clips).where(eq(schema.clips.dayId, day.id));
  if ((count[0]?.n ?? 0) >= MAX_CLIPS_PER_DAY) return new Response("daily limit reached for the hosted demo", { status: 429 });

  const file = body.name.replace(/[^\w.\-]+/g, "_").slice(0, 120) || `clip-${Date.now()}.mp4`;
  const overall = body.shots.length ? body.shots.reduce((a, m) => a + m.score * (m.endSecs - m.startSecs), 0) / Math.max(1, body.durationSecs) : null;
  const [clip] = await db
    .insert(schema.clips)
    .values({ dayId: day.id, tag: clipTag(file), file, shotAt: d, durationSecs: body.durationSecs, language: null, overallScore: overall, isVertical: body.height > body.width, resolution: `${body.width}x${body.height}`, source: "browser", hasAudio: null })
    .onConflictDoUpdate({ target: [schema.clips.dayId, schema.clips.file], set: { shotAt: d, durationSecs: body.durationSecs, overallScore: overall } })
    .returning();
  await db.delete(schema.moments).where(eq(schema.moments.clipId, clip.id));
  const inserted = body.shots.length
    ? await db.insert(schema.moments).values(body.shots.map((m) => ({ clipId: clip.id, startSecs: m.startSecs, endSecs: m.endSecs, score: m.score, bestFrameTs: m.bestFrameTs, features: m.features }))).returning({ id: schema.moments.id })
    : [];

  const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY });
  let caption: string | null = null;
  try {
    const { text } = await generateText({
      model: openai("gpt-5.4-mini"),
      messages: [{ role: "user", content: [{ type: "text", text: "One sentence in English: what is in the frame (people, place, action, light, mood). No preamble." }, { type: "file", mediaType: "image/jpeg", data: Buffer.from(body.bestFrameJpeg.split(",")[1], "base64") }] }],
      maxOutputTokens: 120,
    });
    caption = text.trim();
  } catch (e) {
    console.error("[analyze-client] caption", e instanceof Error ? e.message : e);
  }
  if (caption && inserted.length) {
    const bestIdx = body.shots.reduce((bi, m, i) => (m.score > body.shots[bi].score ? i : bi), 0);
    const { embeddings } = await embedMany({ model: openai.textEmbeddingModel("text-embedding-3-small"), values: [caption] });
    await db.execute(sql`update moments set caption = ${caption}, embedding = ${JSON.stringify(embeddings[0])}::vector where id = ${inserted[bestIdx].id}`);
  }
  return Response.json({ clipId: clip.id, dayId: day.id, tag: clip.tag, file, durationSecs: body.durationSecs, language: null, sentences: 0, moments: inserted.length, caption, bestFrameTs: body.shots[0]?.bestFrameTs ?? null, firstWords: null });
}
