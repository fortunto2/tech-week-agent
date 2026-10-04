// Serve a rendered mp4 (or any file) from the footage root, with Range support for the player.
// Only paths under FOOTAGE_ROOT are allowed; nothing else on the machine is reachable.
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";

const TYPES: Record<string, string> = { ".mp4": "video/mp4", ".mov": "video/quicktime", ".jpg": "image/jpeg", ".srt": "text/plain" };

export async function GET(req: Request) {
  const root = process.env.FOOTAGE_ROOT;
  if (!root) return new Response("FOOTAGE_ROOT missing", { status: 500 });
  const raw = new URL(req.url).searchParams.get("path") ?? "";
  const file = path.resolve(raw);
  if (!file.startsWith(path.resolve(root) + path.sep)) return new Response("forbidden", { status: 403 });
  let size: number;
  try {
    size = (await stat(file)).size;
  } catch {
    return new Response("not found", { status: 404 });
  }
  const type = TYPES[path.extname(file).toLowerCase()] ?? "application/octet-stream";
  const range = req.headers.get("range");
  if (range) {
    const m = range.match(/bytes=(\d*)-(\d*)/);
    const start = m?.[1] ? parseInt(m[1], 10) : 0;
    const end = m?.[2] ? Math.min(parseInt(m[2], 10), size - 1) : Math.min(start + 4 * 1024 * 1024, size - 1);
    const stream = Readable.toWeb(createReadStream(file, { start, end })) as ReadableStream;
    return new Response(stream, {
      status: 206,
      headers: { "Content-Type": type, "Content-Range": `bytes ${start}-${end}/${size}`, "Content-Length": String(end - start + 1), "Accept-Ranges": "bytes" },
    });
  }
  const stream = Readable.toWeb(createReadStream(file)) as ReadableStream;
  return new Response(stream, { headers: { "Content-Type": type, "Content-Length": String(size), "Accept-Ranges": "bytes" } });
}
