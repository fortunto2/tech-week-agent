// Readers for the analysis artefacts life2film/video-analyzer leaves beside each clip:
//   <clip>.va.stt.json  — whisper sentences with word timings, language per clip
//   <clip>.va.otio      — OTIO timeline: usable segments with per-frame quality scores
// Nothing here touches the media; ffprobe is the only shell call (clip time from the container).
import { execFile } from "node:child_process";
import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const execFileP = promisify(execFile);

export const VIDEO_EXT = new Set([".mp4", ".mov", ".m4v"]);

export type SttSidecar = {
  sentences: { text: string; start: number; end: number; words?: { text: string; start: number; end: number; confidence?: number }[] }[];
  language: string | null;
  duration_secs: number;
  model: string;
};

export type OtioSegment = {
  startSecs: number;
  endSecs: number;
  score: number;
  isGarbage: boolean;
  bestFrameTs: number | null;
  features: Record<string, number>;
};

export type OtioSummary = {
  hasAudio: boolean | null;
  overallScore: number | null;
  durationSecs: number | null;
  isVertical: boolean;
  resolution: string | null;
  segments: OtioSegment[];
};

/** DJI_20261001211449_0505_D.MP4 → "0505"; AZ_IMG_8099.MOV → "8099" (first four-digit run, as clip_tag does). */
export function clipTag(file: string): string {
  const m = path.basename(file).match(/(?<!\d)(\d{4})(?!\d)/g);
  if (!m) return path.basename(file, path.extname(file));
  // DJI names start with a 14-digit timestamp; the tag is the four-digit run after it.
  return m[m.length - 1];
}

export async function listClips(folder: string): Promise<string[]> {
  const names = await readdir(folder);
  const out: string[] = [];
  for (const n of names) {
    if (!VIDEO_EXT.has(path.extname(n).toLowerCase())) continue;
    const s = await stat(path.join(folder, n));
    if (s.isFile()) out.push(n);
  }
  return out.sort();
}

export async function readStt(folder: string, file: string): Promise<SttSidecar | null> {
  const base = file.replace(/\.[^.]+$/, "");
  try {
    const raw = await readFile(path.join(folder, `${base}.va.stt.json`), "utf8");
    return JSON.parse(raw) as SttSidecar;
  } catch {
    return null;
  }
}

type RationalTime = { value: number; rate: number };
const secs = (t: RationalTime | undefined) => (t ? t.value / t.rate : 0);

export async function readOtio(folder: string, file: string): Promise<OtioSummary | null> {
  // The analyser names it `<file>.MP4.va.otio` (full name), older runs used `<base>.va.otio`. Try both.
  const base = file.replace(/\.[^.]+$/, "");
  let doc: Record<string, unknown> | null = null;
  for (const name of [`${file}.va.otio`, `${base}.va.otio`]) {
    try {
      doc = JSON.parse(await readFile(path.join(folder, name), "utf8"));
      break;
    } catch {
      /* try the next name */
    }
  }
  if (!doc) return null;
  const va = ((doc.metadata as { va?: Record<string, unknown> } | undefined)?.va ?? {}) as Record<string, unknown>;
  const tracks = (doc.tracks as { children?: { children?: unknown[] }[] } | undefined)?.children ?? [];
  const segments: OtioSegment[] = [];
  for (const track of tracks) {
    for (const c of track.children ?? []) {
      const clip = c as { source_range?: { start_time: RationalTime; duration: RationalTime }; metadata?: { va?: Record<string, unknown> } };
      const sr = clip.source_range;
      if (!sr) continue;
      const m = clip.metadata?.va ?? {};
      const start = secs(sr.start_time);
      segments.push({
        startSecs: start,
        endSecs: start + secs(sr.duration),
        score: Number(m.score ?? 0),
        isGarbage: Boolean(m.is_garbage),
        bestFrameTs: typeof m.best_frame_ts === "number" ? m.best_frame_ts : null,
        features: (m.features_mean as Record<string, number>) ?? {},
      });
    }
  }
  return {
    hasAudio: typeof va.has_audio === "boolean" ? va.has_audio : null,
    overallScore: typeof va.overall_score === "number" ? va.overall_score : null,
    durationSecs: typeof va.duration_secs === "number" ? va.duration_secs : null,
    isVertical: Boolean(va.is_vertical),
    resolution: typeof va.resolution === "string" ? va.resolution : null,
    segments,
  };
}

/** An archived day is a symlink into iCloud Drive; an evicted clip has a size but no blocks on disk. Reading it would download it. */
export async function isOnDisk(file: string): Promise<boolean> {
  try {
    const s = await stat(file);
    return s.blocks > 0 || s.size === 0;
  } catch {
    return false;
  }
}

/** DJI names carry the camera's local time: DJI_20260916230635_0564_D → 2026-09-16 23:06:35 in `tzOffsetHours`. */
export function shotAtFromName(file: string, tzOffsetHours: number): Date | null {
  const m = file.match(/(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/);
  if (!m) return null;
  const [, y, mo, d, h, mi, s] = m.map(Number);
  return new Date(Date.UTC(y, mo - 1, d, h - tzOffsetHours, mi, s));
}

/** Shot time from the container (`creation_time`), the only clock the cameras agree on; the filename when the clip is evicted. */
export async function clipShotAt(folder: string, file: string, tzOffsetHours = -7): Promise<Date | null> {
  const full = path.join(folder, file);
  if (!(await isOnDisk(full))) return shotAtFromName(file, tzOffsetHours);
  try {
    const { stdout } = await execFileP("ffprobe", [
      "-v", "error", "-show_entries", "format_tags=creation_time", "-of", "csv=p=0", full,
    ]);
    const s = stdout.trim();
    return s ? new Date(s) : shotAtFromName(file, tzOffsetHours);
  } catch {
    return shotAtFromName(file, tzOffsetHours);
  }
}
