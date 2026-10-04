// Write the two sidecars video-analyzer's tools expect beside a clip, from our own analysis, so a clip
// uploaded or mailed in today can be cut by vlog_cut.py exactly like a clip analysed by the desktop app:
//   <file>.MP4.va.otio   — OTIO timeline, one Clip per shot with metadata.va {score, is_garbage, best_frame_ts}
//   <base>.va.stt.json   — whisper sentences with word timings and confidence
import { writeFile } from "node:fs/promises";
import path from "node:path";
import type { FrameScore, MomentRow } from "./analyze";

const rt = (secs: number, rate: number) => ({ OTIO_SCHEMA: "RationalTime.1", rate, value: Math.round(secs * rate) });

export async function writeOtioSidecar(
  file: string,
  meta: { durationSecs: number; width: number; height: number; fps: number; hasAudio: boolean },
  moments: MomentRow[],
  frames: FrameScore[],
): Promise<string> {
  const rate = meta.fps || 30;
  const usable = moments.filter((m) => !m.isGarbage).length;
  const overall = moments.length ? moments.reduce((a, m) => a + m.score * (m.endSecs - m.startSecs), 0) / Math.max(1, meta.durationSecs) : 0;
  const children = moments.map((m, i) => ({
    OTIO_SCHEMA: "Clip.2",
    metadata: {
      va: {
        score: m.score,
        is_garbage: m.isGarbage,
        best_frame_ts: m.bestFrameTs,
        frame_count: frames.filter((f) => f.t >= m.startSecs && f.t < m.endSecs).length,
        features_mean: m.features,
      },
    },
    name: `Segment-${i + 1}`,
    source_range: { OTIO_SCHEMA: "TimeRange.1", start_time: rt(m.startSecs, rate), duration: rt(m.endSecs - m.startSecs, rate) },
    effects: [],
    markers: [{ OTIO_SCHEMA: "Marker.2", metadata: {}, name: `score: ${Math.round(m.score * 100)}%`, color: m.isGarbage ? "RED" : "GREEN", marked_range: { OTIO_SCHEMA: "TimeRange.1", start_time: rt(0, rate), duration: rt(m.endSecs - m.startSecs, rate) } }],
    enabled: true,
    media_reference: { OTIO_SCHEMA: "ExternalReference.1", metadata: {}, name: "", available_range: null, available_image_bounds: null, target_url: path.basename(file) },
  }));
  const doc = {
    OTIO_SCHEMA: "Timeline.1",
    metadata: {
      va: {
        version: "0.1.0",
        overall_score: overall,
        genre: "action",
        input_kind: "clip",
        frames_analyzed: frames.length,
        usable_segments: usable,
        runtime_ms: 0,
        resolution: `${meta.width}x${meta.height}`,
        aspect_ratio: meta.height ? meta.width / meta.height : 16 / 9,
        is_vertical: meta.height > meta.width,
        duration_secs: meta.durationSecs,
        fps: rate,
        feature_names: Object.keys(moments[0]?.features ?? {}),
        has_audio: meta.hasAudio,
        slick: { algo: "content", scene_count: moments.length, is_slideshow: false, step_function_ratio: 0, motion_density: moments.map(() => 0) },
        built_from: "life2film-engine (wasm) in Life2Film Director",
      },
    },
    name: path.basename(file).replace(/\.[^.]+$/, ""),
    tracks: {
      OTIO_SCHEMA: "Stack.1",
      metadata: {},
      name: "tracks",
      source_range: null,
      effects: [],
      markers: [],
      enabled: true,
      children: [
        {
          OTIO_SCHEMA: "Track.1",
          metadata: { va: { algo: "content", overall_score: overall, segment_count: moments.length, usable_segments: usable, runtime_ms: 0, genre: "action" } },
          name: "content",
          source_range: null,
          effects: [],
          markers: [],
          enabled: true,
          kind: "Video",
          children,
        },
      ],
    },
  };
  const out = `${file}.va.otio`;
  await writeFile(out, JSON.stringify(doc));
  return out;
}

export async function writeSttSidecar(
  file: string,
  language: string | null,
  durationSecs: number,
  sentences: { text: string; start: number; end: number; words: { text: string; start: number; end: number; confidence?: number }[] }[],
  model = "openai-whisper-small",
): Promise<string> {
  const doc = {
    sentences: sentences.map((s) => ({ text: s.text, start: s.start, end: s.end, words: s.words.map((w) => ({ text: w.text, start: w.start, end: w.end, confidence: w.confidence ?? 0.9 })) })),
    language,
    duration_secs: durationSecs,
    model,
  };
  const out = `${file.replace(/\.[^.]+$/, "")}.va.stt.json`;
  await writeFile(out, JSON.stringify(doc));
  return out;
}
