// Embed every sentence that has no embedding yet (OpenAI text-embedding-3-small, 1536 dims; the Neon AI
// Gateway's embedding model slots in here later). Batches of 100, idempotent, prints a COVERAGE line.
//   pnpm embed
import { createOpenAI } from "@ai-sdk/openai";
import { embedMany } from "ai";
import { isNull, sql } from "drizzle-orm";
import { db, schema } from "../src/db";

const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY });
const EMBED_MODEL = "text-embedding-3-small";

async function main() {
  const rows = await db.select({ id: schema.sentences.id, text: schema.sentences.text }).from(schema.sentences).where(isNull(sql`embedding`));
  console.log(`to embed: ${rows.length}`);
  let done = 0;
  for (let i = 0; i < rows.length; i += 100) {
    const batch = rows.slice(i, i + 100);
    const { embeddings } = await embedMany({ model: openai.textEmbeddingModel(EMBED_MODEL), values: batch.map((r) => r.text) });
    for (let j = 0; j < batch.length; j++) {
      await db.execute(sql`update sentences set embedding = ${JSON.stringify(embeddings[j])}::vector where id = ${batch[j].id}`);
    }
    done += batch.length;
    process.stdout.write(`\r${done}/${rows.length}`);
  }
  const [c] = (await db.execute(sql`select count(*)::int as total, count(embedding)::int as embedded from sentences`)).rows as { total: number; embedded: number }[];
  console.log(`\nCOVERAGE sentences total=${c.total} embedded=${c.embedded} model=${EMBED_MODEL}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
