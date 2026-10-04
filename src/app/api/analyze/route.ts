// Upload one clip and watch it being analysed: the response is NDJSON, one progress event per line
// (probe → every scored frame → shots → whisper sentences → caption → embeddings → done).
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { ingestClip, type Progress } from "@/lib/ingest-clip";

export const maxDuration = 900;

function uploadFolder(): string {
  const root = process.env.FOOTAGE_ROOT;
  if (!root) throw new Error("FOOTAGE_ROOT missing");
  const d = new Date();
  return path.join(root, "!usa", `upload_${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`);
}

export async function POST(req: Request) {
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return new Response("file missing", { status: 400 });
  const folder = uploadFolder();
  await mkdir(folder, { recursive: true });
  const safe = file.name.replace(/[^\w.\-]+/g, "_") || `clip-${Date.now()}.mp4`;
  const target = path.join(folder, safe);
  await writeFile(target, Buffer.from(await file.arrayBuffer()));

  const enc = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (p: Progress | { stage: "error"; message: string }) => controller.enqueue(enc.encode(JSON.stringify(p) + "\n"));
      try {
        await ingestClip(target, { dayTitle: `Uploads ${path.basename(folder).slice(7)}`, source: "upload", onProgress: send });
      } catch (e) {
        send({ stage: "error", message: e instanceof Error ? e.message : String(e) });
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson", "Cache-Control": "no-cache", "X-Accel-Buffering": "no" } });
}
