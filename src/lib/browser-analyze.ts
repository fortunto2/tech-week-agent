"use client";
// Analysis in the browser: the same life2film-engine WASM, fed by <video> + canvas at 2 fps, 128 px wide.
// Nothing is uploaded; only frame scores, shot windows and one best frame (JPEG) leave the device.
import type { Progress } from "@/lib/ingest-clip";
import { importAtRuntime } from "@/lib/dynamic-import";

type Engine = { default: (p: string) => Promise<unknown>; score_frame: (w: number, h: number, rgb: Uint8Array, t: number, g: string | null) => string };

let enginePromise: Promise<Engine> | null = null;
function engine(): Promise<Engine> {
  if (!enginePromise) {
    enginePromise = (async () => {
      const mod = await importAtRuntime<Engine>(`${window.location.origin}/engine/va_wasm.js`);
      await mod.default(`${window.location.origin}/engine/va_wasm_bg.wasm`);
      return mod;
    })();
  }
  return enginePromise;
}

export type BrowserResult = {
  name: string;
  durationSecs: number;
  width: number;
  height: number;
  frames: { t: number; score: number; isGarbage: boolean; sharpness: number; colorfulness: number; brightness: number; motion: number }[];
  shots: { startSecs: number; endSecs: number; score: number; bestFrameTs: number; features: Record<string, number> }[];
  bestFrameJpeg: string; // data URL, 640 px wide
};

const b64 = (u8: Uint8Array) => {
  let s = "";
  for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode(...u8.subarray(i, i + 0x8000));
  return btoa(s);
};

export async function analyzeInBrowser(file: File, onProgress: (p: Progress) => void, opts: { fps?: number } = {}): Promise<BrowserResult> {
  const fps = opts.fps ?? 2;
  const eng = await engine();
  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.src = url;
  video.muted = true;
  video.playsInline = true;
  await new Promise<void>((res, rej) => { video.addEventListener("loadedmetadata", () => res(), { once: true }); video.addEventListener("error", () => rej(new Error("cannot decode this video in the browser")), { once: true }); });
  const durationSecs = video.duration;
  const W = video.videoWidth, H = video.videoHeight;
  onProgress({ stage: "probe", durationSecs, width: W, height: H, fps: 0, hasAudio: false });

  const w = 128, h = Math.max(2, Math.round(((H || 9) / (W || 16)) * w / 2) * 2);
  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  const frames: BrowserResult["frames"] = [];
  const means: { r: number; g: number; b: number }[] = [];
  const feats: Record<string, number>[] = [];
  let best = { t: 0, score: -1 };

  const seek = (t: number) => new Promise<void>((res) => { video.addEventListener("seeked", () => res(), { once: true }); video.currentTime = Math.min(t, Math.max(0, durationSecs - 0.05)); });
  for (let t = 0; t < durationSecs; t += 1 / fps) {
    await seek(t);
    ctx.drawImage(video, 0, 0, w, h);
    const { data } = ctx.getImageData(0, 0, w, h);
    const rgb = new Uint8Array(w * h * 3);
    let sr = 0, sg = 0, sb = 0;
    for (let i = 0, j = 0; i < data.length; i += 4, j += 3) { rgb[j] = data[i]; rgb[j + 1] = data[i + 1]; rgb[j + 2] = data[i + 2]; sr += data[i]; sg += data[i + 1]; sb += data[i + 2]; }
    const n = w * h;
    const mean = { r: sr / n, g: sg / n, b: sb / n };
    const prev = means[means.length - 1];
    const motion = prev ? Math.min(1, (Math.abs(mean.r - prev.r) + Math.abs(mean.g - prev.g) + Math.abs(mean.b - prev.b)) / 96) : 0;
    means.push(mean);
    const r = JSON.parse(eng.score_frame(w, h, rgb, t, null)) as { score: number; is_garbage: boolean; features: Record<string, number> };
    feats.push(r.features);
    const f = { t, score: r.score, isGarbage: r.is_garbage, sharpness: r.features.sharpness ?? 0, colorfulness: r.features.colorfulness ?? 0, brightness: r.features.brightness ?? 0, motion };
    frames.push(f);
    if (!r.is_garbage && r.score > best.score) best = { t, score: r.score };
    onProgress({ stage: "frame", ...f, w, h, rgb: b64(rgb) });
  }

  // Shots: ~4 s windows, median score, mean features (the server does the same for sidecar-less clips).
  const shots: BrowserResult["shots"] = [];
  const n = Math.max(1, Math.round(durationSecs / 4));
  for (let i = 0; i < n; i++) {
    const a = (i * durationSecs) / n, b = ((i + 1) * durationSecs) / n;
    const idx = frames.map((f, k) => (f.t >= a && f.t < b ? k : -1)).filter((k) => k >= 0);
    if (!idx.length) continue;
    const sorted = idx.map((k) => frames[k].score).sort((x, y) => x - y);
    const bestK = idx.reduce((m, k) => (frames[k].score > frames[m].score ? k : m), idx[0]);
    const features: Record<string, number> = {};
    for (const key of Object.keys(feats[idx[0]])) features[key] = Number((idx.reduce((s, k) => s + (feats[k][key] ?? 0), 0) / idx.length).toFixed(4));
    shots.push({ startSecs: a, endSecs: b, score: sorted[Math.floor(sorted.length / 2)], bestFrameTs: frames[bestK].t, features });
  }
  onProgress({ stage: "shots", shots: shots.map(({ startSecs, endSecs, score, bestFrameTs }) => ({ startSecs, endSecs, score, bestFrameTs })) });

  // One best frame at 640 px for the caption model.
  await seek(best.t);
  const big = document.createElement("canvas");
  big.width = 640; big.height = Math.round((H / W) * 640);
  big.getContext("2d")!.drawImage(video, 0, 0, big.width, big.height);
  const bestFrameJpeg = big.toDataURL("image/jpeg", 0.8);
  URL.revokeObjectURL(url);
  return { name: file.name, durationSecs, width: W, height: H, frames, shots, bestFrameJpeg };
}
