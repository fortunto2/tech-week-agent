// Picture analysis for clips that have no sidecars yet (shot today, or mailed in): the life2film-engine
// WASM core scores every sampled frame (31 measurements → one score + garbage flag) and finds the shot
// boundaries; the result is the same `moments` rows the video-analyzer sidecars give us.
// ffmpeg only decodes and scales; nothing leaves the machine.
import { execFile, spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import { importAtRuntime } from "@/lib/dynamic-import";

const execFileP = promisify(execFile);

type Engine = {
  score_frame: (w: number, h: number, rgb24: Uint8Array, timestamp: number, genre?: string | null) => string;
  detect_scenes_content: (inputJson: string) => string;
};

let enginePromise: Promise<Engine> | null = null;
export function engine(): Promise<Engine> {
  if (!enginePromise) {
    enginePromise = (async () => {
      // Non-literal specifier: the bundler must leave this to Node (wasm-pack glue + .wasm bytes resolve at runtime).
      // Both strings are built at runtime so no bundler can constant-fold them into the server bundle.
      const name = process.env.L2F_ENGINE_PKG ?? "life2film-engine";
      const mod = await importAtRuntime<{ default: (i: { module_or_path: Buffer }) => Promise<unknown> } & Engine>(name);
      const wasmPath = process.env.L2F_ENGINE_WASM ?? path.join(process.cwd(), "node_modules", name, "va_wasm_bg.wasm");
      await mod.default({ module_or_path: readFileSync(wasmPath) });
      return mod;
    })();
  }
  return enginePromise;
}

export type FrameScore = { t: number; score: number; isGarbage: boolean; features: Record<string, number>; mean: { r: number; g: number; b: number } };

export async function probe(file: string): Promise<{ durationSecs: number; width: number; height: number; fps: number; shotAt: Date | null; hasAudio: boolean }> {
  const { stdout } = await execFileP("ffprobe", ["-v", "error", "-print_format", "json", "-show_format", "-show_streams", file]);
  const j = JSON.parse(stdout) as { format: { duration: string; tags?: Record<string, string> }; streams: { codec_type: string; width?: number; height?: number; r_frame_rate?: string; side_data_list?: { rotation?: number }[] }[] };
  const v = j.streams.find((s) => s.codec_type === "video");
  const [n, d] = (v?.r_frame_rate ?? "30/1").split("/").map(Number);
  const rot = Math.abs(v?.side_data_list?.find((s) => s.rotation !== undefined)?.rotation ?? 0);
  const swap = rot === 90 || rot === 270;
  const ct = j.format.tags?.creation_time;
  return {
    durationSecs: parseFloat(j.format.duration),
    width: swap ? (v?.height ?? 0) : (v?.width ?? 0),
    height: swap ? (v?.width ?? 0) : (v?.height ?? 0),
    fps: d ? n / d : 30,
    shotAt: ct ? new Date(ct) : null,
    hasAudio: j.streams.some((s) => s.codec_type === "audio"),
  };
}

/** Decode at `fps` samples/second, 128 px wide, and score every frame with the engine. */
export async function scoreFrames(file: string, opts: { fps?: number; width?: number } = {}): Promise<FrameScore[]> {
  const fps = opts.fps ?? 2;
  const w = opts.width ?? 128;
  const eng = await engine();
  const { width: W, height: H } = await probe(file);
  const h = Math.max(2, Math.round(((H || 9) / (W || 16)) * w / 2) * 2);
  const frameBytes = w * h * 3;
  const ff = spawn("ffmpeg", ["-v", "error", "-i", file, "-vf", `fps=${fps},scale=${w}:${h}`, "-f", "rawvideo", "-pix_fmt", "rgb24", "pipe:1"]);
  const out: FrameScore[] = [];
  let buf: Buffer = Buffer.alloc(0);
  let i = 0;
  await new Promise<void>((resolve, reject) => {
    ff.stdout.on("data", (chunk: Buffer) => {
      buf = Buffer.concat([buf, chunk]) as Buffer;
      while (buf.length >= frameBytes) {
        const frame = new Uint8Array(buf.subarray(0, frameBytes));
        buf = buf.subarray(frameBytes) as Buffer;
        const t = i / fps;
        const r = JSON.parse(eng.score_frame(w, h, frame, t, null)) as { score: number; is_garbage: boolean; features: Record<string, number> };
        let sr = 0, sg = 0, sb = 0;
        for (let p = 0; p < frame.length; p += 3) { sr += frame[p]; sg += frame[p + 1]; sb += frame[p + 2]; }
        const n = frame.length / 3;
        out.push({ t, score: r.score, isGarbage: r.is_garbage, features: r.features, mean: { r: sr / n, g: sg / n, b: sb / n } });
        i++;
      }
    });
    ff.on("error", reject);
    ff.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg exited ${code}`))));
  });
  return out;
}

export type MomentRow = { startSecs: number; endSecs: number; score: number; isGarbage: boolean; bestFrameTs: number; features: Record<string, number> };

/** Shots from the engine's content detector, each summarised with the median score (one bad frame must not sink a shot). */
export async function momentsFromFrames(frames: FrameScore[], durationSecs: number): Promise<MomentRow[]> {
  if (!frames.length) return [];
  const eng = await engine();
  const scenes = JSON.parse(
    eng.detect_scenes_content(JSON.stringify({ pixels: frames.map((f) => f.mean), timestamps: frames.map((f) => f.t), duration: durationSecs })),
  ) as { scenes: [number, number][] };
  const ranges = scenes.scenes?.length ? scenes.scenes : [[0, durationSecs] as [number, number]];
  const rows: MomentRow[] = [];
  for (const [a, b] of ranges) {
    const fs = frames.filter((f) => f.t >= a && f.t < b);
    if (!fs.length) continue;
    const sorted = [...fs].sort((x, y) => x.score - y.score);
    const median = sorted[Math.floor(sorted.length / 2)].score;
    const best = fs.reduce((m, f) => (f.score > m.score ? f : m), fs[0]);
    const keys = Object.keys(fs[0].features);
    const features: Record<string, number> = {};
    for (const k of keys) features[k] = Number((fs.reduce((s, f) => s + (f.features[k] ?? 0), 0) / fs.length).toFixed(4));
    rows.push({ startSecs: a, endSecs: b, score: median, isGarbage: fs.filter((f) => f.isGarbage).length > fs.length / 2, bestFrameTs: best.t, features });
  }
  return rows;
}
