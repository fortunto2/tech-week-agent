// Render a saved script into an mp4 on the Mac with the life2film pipeline:
//   script.json → vlog_cut.py --script --voice-over → plan.otio → video-analyzer --render-otio → film.mp4
// Long job (1–3 min for a 3-minute trailer); the tool runs it synchronously and returns the file.
// On Fly this is where a sprite would run; the demo renders locally and says so.
import { createTool } from "@mastra/core/tools";
import { execFile } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";

const execFileP = promisify(execFile);

function vaDir(): string {
  const d = process.env.VIDEO_ANALYZER_DIR;
  if (!d) throw new Error("VIDEO_ANALYZER_DIR missing");
  return d;
}

export const renderScript = createTool({
  id: "render_script",
  description: "Render a saved script to an mp4 trailer (vlog_cut + video-analyzer on this Mac). Returns the media URL for the player. Takes 1–3 minutes.",
  inputSchema: z.object({ scriptId: z.number(), kind: z.enum(["trailer", "episode"]).default("trailer") }),
  outputSchema: z.object({
    renderId: z.number(),
    status: z.string(),
    mediaUrl: z.string().nullable(),
    durationSecs: z.number().nullable(),
    log: z.string(),
  }),
  execute: async ({ scriptId, kind }) => {
    const script = await db.query.scripts.findFirst({ where: eq(schema.scripts.id, scriptId) });
    if (!script) throw new Error(`script ${scriptId} not found`);
    const day = await db.query.days.findFirst({ where: eq(schema.days.id, script.dayId) });
    if (!day) throw new Error(`day ${script.dayId} not found`);

    const [render] = await db.insert(schema.renders).values({ scriptId, kind, status: "rendering" }).returning();
    const outDir = path.join(`${day.folder}-out`, `agent-v${script.version}`);
    await mkdir(outDir, { recursive: true });
    const scriptPath = path.join(outDir, "script.json");
    const otioPath = path.join(outDir, `${kind}.otio`);
    const mp4Path = path.join(outDir, `${kind}.mp4`);
    await writeFile(scriptPath, JSON.stringify(script.body, null, 1));

    const log: string[] = [];
    try {
      const cut = await execFileP(
        "python3",
        [path.join(vaDir(), "scripts/vlog_cut.py"), day.folder, "--script", scriptPath, "--voice-over", "--out", otioPath],
        { cwd: vaDir(), timeout: 10 * 60_000, maxBuffer: 16 * 1024 * 1024 },
      );
      log.push(cut.stdout.slice(-2000), cut.stderr.slice(-2000));
      const bin = process.env.VIDEO_ANALYZER_BIN ?? path.join(vaDir(), "target/release/video-analyzer");
      const rend = await execFileP(bin, [`--render-otio=${otioPath}`, `--out=${mp4Path}`], { cwd: vaDir(), timeout: 20 * 60_000, maxBuffer: 16 * 1024 * 1024 });
      log.push(rend.stdout.slice(-1000), rend.stderr.slice(-1000));
      const probe = await execFileP("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", mp4Path]);
      const durationSecs = parseFloat(probe.stdout.trim()) || null;
      await db.update(schema.renders).set({ status: "done", path: mp4Path, durationSecs, log: log.join("\n") }).where(eq(schema.renders.id, render.id));
      return { renderId: render.id, status: "done", mediaUrl: `/api/media?path=${encodeURIComponent(mp4Path)}`, durationSecs, log: log.join("\n").slice(-1500) };
    } catch (e) {
      const msg = e instanceof Error ? `${e.message}\n${(e as { stderr?: string }).stderr ?? ""}` : String(e);
      log.push(msg);
      await db.update(schema.renders).set({ status: "failed", log: log.join("\n") }).where(eq(schema.renders.id, render.id));
      return { renderId: render.id, status: "failed", mediaUrl: null, durationSecs: null, log: log.join("\n").slice(-1500) };
    }
  },
});
