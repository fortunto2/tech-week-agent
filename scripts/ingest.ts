// Ingest one footage folder into Neon: clips + sentences (speech) + moments (picture).
//   pnpm ingest ~/Movies/!usa/cali_1week "Неделя в долине"
// Reads the sidecars video-analyzer already wrote beside the clips; never re-analyses, never uploads media.
// Prints a COVERAGE line so an empty result is visible as empty, not mistaken for success.

import path from "node:path";
import { eq } from "drizzle-orm";
import { db, schema } from "../src/db";
import { clipShotAt, clipTag, listClips, readOtio, readStt } from "../src/lib/sidecars";

async function main() {
  const [folderArg, titleArg, tzArg] = process.argv.slice(2);
  if (!folderArg) {
    console.error("usage: pnpm ingest <folder> [title] [tzOffsetHours for filename times, e.g. -5 for Chicago]");
    process.exit(2);
  }
  const tz = tzArg ? Number(tzArg) : -7;
  const folder = path.resolve(folderArg.replace(/^~/, process.env.HOME ?? ""));
  const title = titleArg ?? path.basename(folder);
  const files = await listClips(folder);
  if (!files.length) {
    console.error(`no video files in ${folder}`);
    process.exit(2);
  }

  const [day] = await db
    .insert(schema.days)
    .values({ folder, title })
    .onConflictDoUpdate({ target: schema.days.folder, set: { title } })
    .returning();

  let withSpeech = 0;
  let withPicture = 0;
  let sentencesN = 0;
  let momentsN = 0;
  let shotFrom: Date | null = null;
  let shotTo: Date | null = null;

  for (const file of files) {
    const [stt, otio, shotAt] = await Promise.all([readStt(folder, file), readOtio(folder, file), clipShotAt(folder, file, tz)]);
    if (shotAt) {
      if (!shotFrom || shotAt < shotFrom) shotFrom = shotAt;
      if (!shotTo || shotAt > shotTo) shotTo = shotAt;
    }
    const [clip] = await db
      .insert(schema.clips)
      .values({
        dayId: day.id,
        tag: clipTag(file),
        file,
        shotAt,
        durationSecs: otio?.durationSecs ?? stt?.duration_secs ?? null,
        language: stt?.sentences.length ? stt.language : null,
        overallScore: otio?.overallScore ?? null,
        isVertical: otio?.isVertical ?? false,
        resolution: otio?.resolution ?? null,
        hasAudio: otio?.hasAudio ?? null,
      })
      .onConflictDoUpdate({
        target: [schema.clips.dayId, schema.clips.file],
        set: { shotAt, language: stt?.sentences.length ? stt.language : null, overallScore: otio?.overallScore ?? null, hasAudio: otio?.hasAudio ?? null },
      })
      .returning();

    // Idempotent: wipe and rewrite the clip's children (sidecars are the source of truth).
    await db.delete(schema.sentences).where(eq(schema.sentences.clipId, clip.id));
    await db.delete(schema.moments).where(eq(schema.moments.clipId, clip.id));

    if (stt?.sentences.length) {
      withSpeech++;
      await db.insert(schema.sentences).values(
        stt.sentences.map((s, idx) => ({ clipId: clip.id, idx, text: s.text, startSecs: s.start, endSecs: s.end, words: s.words ?? [] })),
      );
      sentencesN += stt.sentences.length;
    }
    if (otio?.segments.length) {
      withPicture++;
      await db.insert(schema.moments).values(
        otio.segments.map((m) => ({
          clipId: clip.id,
          startSecs: m.startSecs,
          endSecs: m.endSecs,
          score: m.score,
          isGarbage: m.isGarbage,
          bestFrameTs: m.bestFrameTs,
          features: m.features,
        })),
      );
      momentsN += otio.segments.length;
    }
  }

  await db.update(schema.days).set({ shotFrom, shotTo }).where(eq(schema.days.id, day.id));
  console.log(
    `COVERAGE day=${day.id} "${title}" clips=${files.length} speech=${withSpeech} picture=${withPicture} ` +
      `sentences=${sentencesN} moments=${momentsN} shot=${shotFrom?.toISOString() ?? "?"}..${shotTo?.toISOString() ?? "?"}`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
