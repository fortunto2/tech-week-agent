// Where new footage lands on the Mac, and how an untrusted filename becomes a safe one.
import path from "node:path";

export function footageRoot(): string {
  const root = process.env.FOOTAGE_ROOT;
  if (!root) throw new Error("FOOTAGE_ROOT missing");
  return root;
}

/** `<FOOTAGE_ROOT>/<FOOTAGE_DAYS_DIR>/<prefix>_YYYYMMDD` — the folder for clips that arrive today. */
export function dayFolder(prefix: "inbox" | "upload", d = new Date()): string {
  const days = process.env.FOOTAGE_DAYS_DIR ?? "!usa";
  const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  return path.join(footageRoot(), days, `${prefix}_${stamp}`);
}

/** Basename only, safe characters only, never a dot-only name. */
export function safeName(name: string | undefined, fallbackExt = ".mp4"): string {
  const base = path.basename(name ?? "").replace(/[^\w.\-]+/g, "_");
  if (!base || /^\.+$/.test(base)) return `clip-${Date.now()}${fallbackExt}`;
  return base;
}

export const VIDEO_TYPES = new Set(["video/mp4", "video/quicktime", "video/x-m4v"]);
export const isVideoName = (name: string | undefined) => /\.(mp4|mov|m4v)$/i.test(name ?? "");
