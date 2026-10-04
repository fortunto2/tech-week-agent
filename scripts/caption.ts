// Picture memory: one caption per clip (its best-scoring usable moment), written by a vision model from the
// frame at best_frame_ts, then embedded, so "закат у океана" or "дочка смеётся" finds footage with no speech.
//   pnpm caption            — every clip without a caption
// Frames are extracted with ffmpeg into the scratch dir and deleted; nothing but a 1-sentence caption is stored.
import { createOpenAI } from "@ai-sdk/openai";
import { embedMany, generateText } from "ai";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { sql } from "drizzle-orm";
import { db } from "../src/db";

const execFileP = promisify(execFile);
const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY });
const VISION_MODEL = "gpt-5.4-mini";
const EMBED_MODEL = "text-embedding-3-small";
const CONCURRENCY = 6;

type Row = { moment_id: number; clip_id: number; tag: string; file: string; folder: string; ts: number };

async function main() {
  // Best usable moment per clip that has no caption yet.
  const res = await db.execute(sql`
    select distinct on (m.clip_id) m.id as moment_id, m.clip_id, c.tag, c.file, d.folder,
           coalesce(m.best_frame_ts, (m.start_secs + m.end_secs) / 2) as ts
    from moments m join clips c on c.id = m.clip_id join days d on d.id = c.day_id
    where coalesce(m.is_garbage, false) = false
      and not exists (select 1 from moments x where x.clip_id = m.clip_id and x.caption is not null)
    order by m.clip_id, m.score desc`);
  const rows = res.rows as Row[];
  console.log(`clips to caption: ${rows.length}`);
  const tmp = await mkdtemp(path.join(os.tmpdir(), "l2f-frames-"));
  let done = 0;
  const captions: { moment_id: number; caption: string }[] = [];

  const work = async (r: Row) => {
    const jpg = path.join(tmp, `${r.tag}.jpg`);
    try {
      await execFileP("ffmpeg", ["-y", "-v", "error", "-ss", String(r.ts), "-i", path.join(r.folder, r.file), "-frames:v", "1", "-vf", "scale=768:-2", "-q:v", "4", jpg]);
      const image = await readFile(jpg);
      const { text } = await generateText({
        model: openai(VISION_MODEL),
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: "Одно предложение по-русски: что в кадре (люди, место, действие, свет, настроение). Без вступлений." },
              { type: "file", mediaType: "image/jpeg", data: image },
            ],
          },
        ],
        maxOutputTokens: 120,
      });
      captions.push({ moment_id: r.moment_id, caption: text.trim() });
    } catch (e) {
      console.error(`\n${r.tag}: ${e instanceof Error ? e.message.slice(0, 120) : e}`);
    } finally {
      await rm(jpg, { force: true });
      done++;
      process.stdout.write(`\r${done}/${rows.length}`);
    }
  };
  for (let i = 0; i < rows.length; i += CONCURRENCY) await Promise.all(rows.slice(i, i + CONCURRENCY).map(work));

  for (let i = 0; i < captions.length; i += 100) {
    const batch = captions.slice(i, i + 100);
    const { embeddings } = await embedMany({ model: openai.textEmbeddingModel(EMBED_MODEL), values: batch.map((c) => c.caption) });
    for (let j = 0; j < batch.length; j++) {
      await db.execute(sql`update moments set caption = ${batch[j].caption}, embedding = ${JSON.stringify(embeddings[j])}::vector where id = ${batch[j].moment_id}`);
    }
  }
  await rm(tmp, { recursive: true, force: true });
  const [c] = (await db.execute(sql`select count(distinct clip_id)::int as clips from moments where caption is not null`)).rows as { clips: number }[];
  console.log(`\nCOVERAGE captions clips=${c.clips} added=${captions.length} model=${VISION_MODEL}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
