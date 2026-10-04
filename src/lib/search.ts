// Hybrid search over everything that was said on camera: Lakebase vector (cosine) + BM25, fused with RRF.
// Returns moments the owner can jump to or hand to the director as the focus of a film.
import { createOpenAI } from "@ai-sdk/openai";
import { embed } from "ai";
import { sql } from "drizzle-orm";
import { db } from "@/db";

const EMBED_MODEL = "text-embedding-3-small";

export type FootageHit = {
  sentenceId: number;
  clipId: number;
  clipTag: string;
  dayId: number;
  dayTitle: string;
  idx: number;
  text: string;
  startSecs: number;
  endSecs: number;
  shotAt: string | null;
  language: string | null;
  score: number;
  via: "both" | "vector" | "keyword";
};

export async function embedQuery(text: string): Promise<number[]> {
  const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const { embedding } = await embed({ model: openai.textEmbeddingModel(EMBED_MODEL), value: text });
  return embedding;
}

export async function searchFootage(query: string, opts: { k?: number; dayId?: number } = {}): Promise<FootageHit[]> {
  const k = opts.k ?? 12;
  const vec = JSON.stringify(await embedQuery(query));
  const dayFilter = opts.dayId ? sql`and c.day_id = ${opts.dayId}` : sql``;
  // 40 candidates per retriever, k = 60: the documented RRF starting point.
  const res = await db.execute(sql`
    with vector_ranked as (
      select id, rank() over (order by distance) as rank from (
        select s.id, s.embedding <=> ${vec}::vector as distance
        from sentences s join clips c on c.id = s.clip_id
        where s.embedding is not null ${dayFilter}
        order by distance fetch first 40 rows with ties
      ) v
    ),
    keyword_ranked as (
      select id, rank() over (order by score) as rank from (
        select id, score from (
          select s.id, s.tsv <@> to_bm25query(to_tsvector('russian', ${query}) || to_tsvector('english', ${query}), 'sentences_tsv_bm25'::regclass) as score
          from sentences s join clips c on c.id = s.clip_id
          where true ${dayFilter}
        ) scored
        where score < 0
        order by score fetch first 40 rows only
      ) kw
    )
    select s.id as sentence_id, s.clip_id, c.tag as clip_tag, c.day_id, d.title as day_title, s.idx, s.text,
           s.start_secs, s.end_secs, c.shot_at, c.language,
           coalesce(1.0/(60+v.rank),0) + coalesce(1.0/(60+kw.rank),0) as rrf,
           (v.id is not null) as in_vec, (kw.id is not null) as in_kw
    from sentences s
    join clips c on c.id = s.clip_id
    join days d on d.id = c.day_id
    left join vector_ranked v on v.id = s.id
    left join keyword_ranked kw on kw.id = s.id
    where v.id is not null or kw.id is not null
    order by rrf desc, s.id
    limit ${k}`);
  return (res.rows as Record<string, unknown>[]).map((r) => ({
    sentenceId: Number(r.sentence_id),
    clipId: Number(r.clip_id),
    clipTag: String(r.clip_tag),
    dayId: Number(r.day_id),
    dayTitle: String(r.day_title),
    idx: Number(r.idx),
    text: String(r.text),
    startSecs: Number(r.start_secs),
    endSecs: Number(r.end_secs),
    shotAt: r.shot_at ? new Date(r.shot_at as string).toISOString() : null,
    language: (r.language as string) ?? null,
    score: Number(r.rrf),
    via: r.in_vec && r.in_kw ? "both" : r.in_vec ? "vector" : "keyword",
  }));
}

export type PictureHit = { momentId: number; clipTag: string; dayId: number; dayTitle: string; startSecs: number; endSecs: number; caption: string; shotAt: string | null; distance: number };

/** What the camera saw: cosine search over the per-clip captions in `moments`. */
export async function searchPictures(query: string, opts: { k?: number; dayId?: number } = {}): Promise<PictureHit[]> {
  const k = opts.k ?? 8;
  const vec = JSON.stringify(await embedQuery(query));
  const dayFilter = opts.dayId ? sql`and c.day_id = ${opts.dayId}` : sql``;
  const res = await db.execute(sql`
    select m.id as moment_id, c.tag as clip_tag, c.day_id, d.title as day_title, m.start_secs, m.end_secs, m.caption, c.shot_at,
           m.embedding <=> ${vec}::vector as distance
    from moments m join clips c on c.id = m.clip_id join days d on d.id = c.day_id
    where m.caption is not null ${dayFilter}
    order by distance limit ${k}`);
  return (res.rows as Record<string, unknown>[]).map((r) => ({
    momentId: Number(r.moment_id),
    clipTag: String(r.clip_tag),
    dayId: Number(r.day_id),
    dayTitle: String(r.day_title),
    startSecs: Number(r.start_secs),
    endSecs: Number(r.end_secs),
    caption: String(r.caption),
    shotAt: r.shot_at ? new Date(r.shot_at as string).toISOString() : null,
    distance: Number(r.distance),
  }));
}
