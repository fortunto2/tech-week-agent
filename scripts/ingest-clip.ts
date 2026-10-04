// Ingest one or more new clips (no sidecars needed): engine frame scores + whisper + caption + embeddings.
//   pnpm ingest-clip ~/Movies/!usa/hack_1004/clip.MP4 [more files…]
import { ingestClip } from "../src/lib/ingest-clip";

async function main() {
  const files = process.argv.slice(2);
  if (!files.length) {
    console.error("usage: pnpm ingest-clip <file> [file…]");
    process.exit(2);
  }
  for (const f of files) {
    const r = await ingestClip(f);
    console.log(`COVERAGE clip=${r.tag} day=${r.dayId} dur=${r.durationSecs.toFixed(1)}s lang=${r.language ?? "silent"} sentences=${r.sentences} moments=${r.moments} caption=${r.caption ? "yes" : "no"} first="${r.firstWords ?? ""}"`);
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
