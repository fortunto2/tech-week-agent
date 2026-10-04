// The render job: script.json → vlog_cut.py --script --voice-over → plan.otio → video-analyzer --render-otio → mp4
// (+ a poster frame). Runs in the background of the server process; status and log live in `renders`, the
// chat card polls /api/renders/<id>. On Fly this is the job a sprite would run.
import { execFile, spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";

const execFileP = promisify(execFile);

function vaDir(): string {
  const d = process.env.VIDEO_ANALYZER_DIR;
  if (!d) throw new Error("VIDEO_ANALYZER_DIR missing");
  return d;
}

/** Run a process, streaming its last lines into the render log so the card can show progress. */
function run(cmd: string, args: string[], cwd: string, onLine: (line: string) => void, timeoutMs: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { cwd });
    const timer = setTimeout(() => { child.kill("SIGKILL"); reject(new Error(`${path.basename(cmd)} timed out`)); }, timeoutMs);
    let tail = "";
    const feed = (chunk: Buffer) => {
      tail += chunk.toString();
      const lines = tail.split(/\r?\n/);
      tail = lines.pop() ?? "";
      for (const l of lines) if (l.trim()) onLine(l.trim());
    };
    child.stdout.on("data", feed);
    child.stderr.on("data", feed);
    child.on("error", (e) => { clearTimeout(timer); reject(e); });
    child.on("close", (code) => { clearTimeout(timer); if (tail.trim()) onLine(tail.trim()); code === 0 ? resolve() : reject(new Error(`${path.basename(cmd)} exited ${code}`)); });
  });
}

export const mediaUrl = (p: string) => `/api/media?path=${encodeURIComponent(p)}`;
export const posterPath = (mp4: string) => mp4.replace(/\.mp4$/, ".jpg");

export async function startRender(scriptId: number, kind: "trailer" | "episode"): Promise<{ renderId: number; outDir: string }> {
  const script = await db.query.scripts.findFirst({ where: eq(schema.scripts.id, scriptId) });
  if (!script) throw new Error(`script ${scriptId} not found`);
  const day = await db.query.days.findFirst({ where: eq(schema.days.id, script.dayId) });
  if (!day) throw new Error(`day ${script.dayId} not found`);
  const outDir = path.join(`${day.folder}-out`, `agent-v${script.version}`);
  await mkdir(outDir, { recursive: true });
  await writeFile(path.join(outDir, "script.json"), JSON.stringify(script.body, null, 1));
  const [render] = await db.insert(schema.renders).values({ scriptId, kind, status: "rendering", log: "queued" }).returning();
  void runRender(render.id, day.folder, outDir, kind).catch((e) => console.error("[render]", e));
  return { renderId: render.id, outDir };
}

async function runRender(renderId: number, dayFolder: string, outDir: string, kind: string): Promise<void> {
  const scriptPath = path.join(outDir, "script.json");
  const otioPath = path.join(outDir, `${kind}.otio`);
  const mp4Path = path.join(outDir, `${kind}.mp4`);
  const log: string[] = [];
  let lastWrite = 0;
  const note = async (line: string, force = false) => {
    log.push(line);
    if (log.length > 60) log.splice(0, log.length - 60);
    if (force || Date.now() - lastWrite > 1500) {
      lastWrite = Date.now();
      await db.update(schema.renders).set({ log: log.join("\n") }).where(eq(schema.renders.id, renderId));
    }
  };
  try {
    await note("vlog_cut: laying out speech and cutaways…", true);
    await run("python3", [path.join(vaDir(), "scripts/vlog_cut.py"), dayFolder, "--script", scriptPath, "--voice-over", "--out", otioPath], vaDir(), (l) => void note(l), 10 * 60_000);
    await note("render: encoding the timeline…", true);
    const bin = process.env.VIDEO_ANALYZER_BIN ?? path.join(vaDir(), "target/release/video-analyzer");
    await run(bin, [`--render-otio=${otioPath}`, `--out=${mp4Path}`], vaDir(), (l) => void note(l), 20 * 60_000);
    const probe = await execFileP("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", mp4Path]);
    const durationSecs = parseFloat(probe.stdout.trim()) || null;
    await execFileP("ffmpeg", ["-y", "-v", "error", "-ss", "1.5", "-i", mp4Path, "-frames:v", "1", "-vf", "scale=640:-2", "-q:v", "4", posterPath(mp4Path)]).catch(() => {});
    await db.update(schema.renders).set({ status: "done", path: mp4Path, durationSecs, log: [...log, "done"].join("\n") }).where(eq(schema.renders.id, renderId));
  } catch (e) {
    log.push(e instanceof Error ? e.message : String(e));
    await db.update(schema.renders).set({ status: "failed", log: log.join("\n") }).where(eq(schema.renders.id, renderId));
  }
}

export async function renderStatus(renderId: number) {
  const r = await db.query.renders.findFirst({ where: eq(schema.renders.id, renderId) });
  if (!r) return null;
  const lines = (r.log ?? "").split("\n").filter(Boolean);
  return {
    renderId: r.id,
    status: r.status,
    mediaUrl: r.status === "done" && r.path ? mediaUrl(r.path) : null,
    posterUrl: r.status === "done" && r.path ? mediaUrl(posterPath(r.path)) : null,
    durationSecs: r.durationSecs,
    progress: lines.slice(-3).join("\n"),
  };
}
