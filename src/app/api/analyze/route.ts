// Upload one clip and watch it being analysed: the response is NDJSON, one progress event per line
// (probe → every scored frame → shots → whisper sentences → caption → embeddings → done).
import { createWriteStream } from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { dayFolder, isVideoName, safeName, VIDEO_TYPES } from "@/lib/footage";
import { ingestClip, type Progress } from "@/lib/ingest-clip";

export const maxDuration = 900;
const MAX_BYTES = 2 * 1024 * 1024 * 1024; // 2 GB: a long 4K clip; anything bigger belongs in a folder ingest

export async function POST(req: Request) {
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return new Response("file missing", { status: 400 });
  if (!(VIDEO_TYPES.has(file.type) || isVideoName(file.name))) return new Response("not a video (mp4/mov/m4v)", { status: 415 });
  if (file.size > MAX_BYTES) return new Response("file too large", { status: 413 });

  const folder = dayFolder("upload");
  await mkdir(folder, { recursive: true });
  const target = path.join(folder, safeName(file.name));
  // Stream to disk; never hold the clip in memory.
  await pipeline(Readable.fromWeb(file.stream() as import("node:stream/web").ReadableStream), createWriteStream(target));

  const enc = new TextEncoder();
  let closed = false;
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      // A reload or closed tab cancels the stream; ffmpeg's data listener keeps calling us synchronously,
      // so a send after cancel must be a no-op, never a throw.
      const send = (p: Progress | { stage: "error"; message: string }) => {
        if (closed) return;
        try {
          controller.enqueue(enc.encode(JSON.stringify(p) + "\n"));
        } catch {
          closed = true;
        }
      };
      try {
        await ingestClip(target, { dayTitle: `Uploads ${path.basename(folder).slice(7)}`, source: "upload", onProgress: send });
      } catch (e) {
        send({ stage: "error", message: e instanceof Error ? e.message : String(e) });
      } finally {
        if (!closed) {
          closed = true;
          try { controller.close(); } catch { /* already closed by cancel */ }
        }
      }
    },
    cancel() {
      closed = true; // the ingest finishes on its own and lands in Neon; only the reporting stops
    },
  });
  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson", "Cache-Control": "no-cache", "X-Accel-Buffering": "no" } });
}
