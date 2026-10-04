// One new clip → Neon, with no sidecars: picture via the life2film engine (WASM), speech via whisper,
// a caption of the best frame via a vision model, embeddings for both. The same rows `pnpm ingest` writes
// from the video-analyzer sidecars, so the director and the search see today's footage like any other day.
import { createOpenAI } from "@ai-sdk/openai";
import { embedMany, generateText } from "ai";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { clipTag } from "@/lib/sidecars";
import { momentsFromFrames, probe, scoreFrames } from "@/lib/analyze";

const execFileP = promisify(execFile);
const openai = () => createOpenAI({ apiKey: process.env.OPENAI_API_KEY });
const VISION_MODEL = "gpt-5.4-mini";
const EMBED_MODEL = "text-embedding-3-small";

export type Progress =
  | { stage: "probe"; durationSecs: number; width: number; height: number; fps: number; hasAudio: boolean }
  | { stage: "frame"; t: number; score: number; isGarbage: boolean; sharpness: number; colorfulness: number; brightness: number; motion: number; w?: number; h?: number; rgb?: string }
  | { stage: "shots"; shots: { startSecs: number; endSecs: number; score: number; bestFrameTs: number }[] }
  | { stage: "whisper"; status: "start" | "done"; sentences?: { idx: number; text: string; start: number; end: number }[]; language?: string | null }
  | { stage: "caption"; caption: string | null }
  | { stage: "embeddings"; count: number }
  | { stage: "done"; clip: IngestedClip };

export type IngestedClip = {
  clipId: number;
  dayId: number;
  tag: string;
  file: string;
  durationSecs: number;
  language: string | null;
  sentences: number;
  moments: number;
  caption: string | null;
  bestFrameTs: number | null;
  firstWords: string | null;
};

type WhisperJson = { language?: string; segments: { start: number; end: number; text: string; words?: { word: string; start: number; end: number; probability?: number }[] }[] };

async function transcribe(file: string, tmp: string): Promise<WhisperJson | null> {
  try {
    // openai-whisper CLI; `small` is cached on this Mac (turbo is a 1.5 GB download), ~1x realtime on CPU. Output: <base>.json in tmp.
    await execFileP("whisper", [file, "--model", process.env.WHISPER_MODEL ?? "small", "--output_format", "json", "--word_timestamps", "True", "--output_dir", tmp, "--verbose", "False"], { timeout: 15 * 60_000, maxBuffer: 32 * 1024 * 1024 });
    const base = path.basename(file).replace(/\.[^.]+$/, "");
    return JSON.parse(await readFile(path.join(tmp, `${base}.json`), "utf8")) as WhisperJson;
  } catch (e) {
    console.error(`[ingest-clip] whisper failed for ${path.basename(file)}: ${e instanceof Error ? e.message.slice(0, 200) : e}`);
    return null;
  }
}

async function captionFrame(file: string, ts: number, tmp: string): Promise<string | null> {
  const jpg = path.join(tmp, `cap-${Date.now()}.jpg`);
  try {
    await execFileP("ffmpeg", ["-y", "-v", "error", "-ss", String(ts), "-i", file, "-frames:v", "1", "-vf", "scale=768:-2", "-q:v", "4", jpg]);
    const { text } = await generateText({
      model: openai()(VISION_MODEL),
      messages: [{ role: "user", content: [{ type: "text", text: "Одно предложение по-русски: что в кадре (люди, место, действие, свет, настроение). Без вступлений." }, { type: "file", mediaType: "image/jpeg", data: await readFile(jpg) }] }],
      maxOutputTokens: 120,
    });
    return text.trim();
  } catch {
    return null;
  } finally {
    await rm(jpg, { force: true });
  }
}

/** Ingest one video file into the day whose folder contains it (the day row is created on first use). */
export async function ingestClip(file: string, opts: { dayTitle?: string; source?: string; onProgress?: (p: Progress) => void } = {}): Promise<IngestedClip> {
  const emit = (p: Progress) => opts.onProgress?.(p);
  const folder = path.dirname(path.resolve(file));
  const base = path.basename(file);
  const tmp = await mkdtemp(path.join(os.tmpdir(), "l2f-ingest-"));
  try {
    const [day] = await db
      .insert(schema.days)
      .values({ folder, title: opts.dayTitle ?? path.basename(folder) })
      .onConflictDoUpdate({ target: schema.days.folder, set: { folder } })
      .returning();

    const meta = await probe(file);
    emit({ stage: "probe", durationSecs: meta.durationSecs, width: meta.width, height: meta.height, fps: meta.fps, hasAudio: meta.hasAudio });
    if (meta.hasAudio) emit({ stage: "whisper", status: "start" });
    const [frames, stt] = await Promise.all([
      scoreFrames(file, {
        size: { width: meta.width, height: meta.height },
        // The 128 px frame the engine scored travels with the event (base64 RGB24, ~27 KB) so the UI can show it.
        onFrame: (f, _i, raw) => emit({ stage: "frame", t: f.t, score: f.score, isGarbage: f.isGarbage, sharpness: f.features.sharpness ?? 0, colorfulness: f.features.colorfulness ?? 0, brightness: f.features.brightness ?? 0, motion: f.motion, w: raw.w, h: raw.h, rgb: opts.onProgress ? Buffer.from(raw.rgb24).toString("base64") : undefined }),
      }),
      meta.hasAudio ? transcribe(file, tmp) : Promise.resolve(null),
    ]);
    const moments = await momentsFromFrames(frames, meta.durationSecs);
    emit({ stage: "shots", shots: moments.map((m) => ({ startSecs: m.startSecs, endSecs: m.endSecs, score: m.score, bestFrameTs: m.bestFrameTs })) });
    const sentences = (stt?.segments ?? []).map((s) => ({ text: s.text.trim(), start: s.start, end: s.end, words: (s.words ?? []).map((w) => ({ text: w.word.trim(), start: w.start, end: w.end, confidence: w.probability })) })).filter((s) => s.text);
    if (meta.hasAudio) emit({ stage: "whisper", status: "done", language: stt?.language ?? null, sentences: sentences.map((s, idx) => ({ idx, text: s.text, start: s.start, end: s.end })) });
    const overall = moments.length ? moments.reduce((a, m) => a + m.score * (m.endSecs - m.startSecs), 0) / Math.max(1, meta.durationSecs) : null;

    const [clip] = await db
      .insert(schema.clips)
      .values({ dayId: day.id, tag: clipTag(base), file: base, shotAt: meta.shotAt, durationSecs: meta.durationSecs, language: sentences.length ? (stt?.language ?? null) : null, overallScore: overall, isVertical: meta.height > meta.width, resolution: `${meta.width}x${meta.height}`, source: opts.source ?? "folder" })
      .onConflictDoUpdate({ target: [schema.clips.dayId, schema.clips.file], set: { shotAt: meta.shotAt, durationSecs: meta.durationSecs, language: sentences.length ? (stt?.language ?? null) : null, overallScore: overall, source: opts.source ?? "folder" } })
      .returning();
    await db.delete(schema.sentences).where(eq(schema.sentences.clipId, clip.id));
    await db.delete(schema.moments).where(eq(schema.moments.clipId, clip.id));

    if (sentences.length) {
      const inserted = await db.insert(schema.sentences).values(sentences.map((s, idx) => ({ clipId: clip.id, idx, text: s.text, startSecs: s.start, endSecs: s.end, words: s.words }))).returning({ id: schema.sentences.id });
      const { embeddings } = await embedMany({ model: openai().textEmbeddingModel(EMBED_MODEL), values: sentences.map((s) => s.text) });
      for (let i = 0; i < inserted.length; i++) await db.execute(sql`update sentences set embedding = ${JSON.stringify(embeddings[i])}::vector where id = ${inserted[i].id}`);
    }

    let caption: string | null = null;
    let bestFrameTs: number | null = null;
    if (moments.length) {
      const inserted = await db.insert(schema.moments).values(moments.map((m) => ({ clipId: clip.id, startSecs: m.startSecs, endSecs: m.endSecs, score: m.score, isGarbage: m.isGarbage, bestFrameTs: m.bestFrameTs, features: m.features }))).returning({ id: schema.moments.id });
      const bestIdx = moments.reduce((bi, m, i) => (!m.isGarbage && m.score > moments[bi].score ? i : bi), 0);
      bestFrameTs = moments[bestIdx].bestFrameTs;
      caption = await captionFrame(file, bestFrameTs, tmp);
      emit({ stage: "caption", caption });
      if (caption) {
        const { embeddings } = await embedMany({ model: openai().textEmbeddingModel(EMBED_MODEL), values: [caption] });
        await db.execute(sql`update moments set caption = ${caption}, embedding = ${JSON.stringify(embeddings[0])}::vector where id = ${inserted[bestIdx].id}`);
      }
    }
    emit({ stage: "embeddings", count: sentences.length + (caption ? 1 : 0) });
    const result: IngestedClip = { clipId: clip.id, dayId: day.id, tag: clip.tag, file: base, durationSecs: meta.durationSecs, language: clip.language, sentences: sentences.length, moments: moments.length, caption, bestFrameTs, firstWords: sentences[0]?.text.slice(0, 80) ?? null };
    emit({ stage: "done", clip: result });
    return result;
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
}
