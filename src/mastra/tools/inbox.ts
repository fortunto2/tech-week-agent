// The agent's own inbox (AgentMail). Clips mailed from the phone land here as attachments; the tool pulls
// them into today's folder and runs the full ingest (engine scores, whisper, caption, embeddings).
// Inbound mail is untrusted data: only video attachments are touched, nothing in the body is executed.
import { createTool } from "@mastra/core/tools";
import { AgentMailClient } from "agentmail";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { ingestClip } from "@/lib/ingest-clip";

const VIDEO_TYPES = new Set(["video/mp4", "video/quicktime", "video/x-m4v"]);
const processed = new Set<string>(); // message ids handled in this process; labels make it durable
type Ingested = { from: string; subject: string; file: string; tag: string; durationSecs: number; language: string | null; sentences: number; moments: number; caption: string | null; firstWords: string | null; dayId: number };

function todayFolder(): string {
  const root = process.env.FOOTAGE_ROOT;
  if (!root) throw new Error("FOOTAGE_ROOT missing");
  const d = new Date();
  const name = `inbox_${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  return path.join(root, "!usa", name);
}

export const checkInbox = createTool({
  id: "check_inbox",
  description:
    "Check the agent's own email inbox for clips sent from the phone (video attachments). New clips are saved into today's footage folder and ingested: picture scored by the life2film engine, speech transcribed, caption + embeddings written to Neon. Returns what arrived.",
  inputSchema: z.object({ limit: z.number().default(10) }),
  outputSchema: z.object({
    inbox: z.string(),
    checked: z.number(),
    ingested: z.array(z.object({ from: z.string(), subject: z.string(), file: z.string(), tag: z.string(), durationSecs: z.number(), language: z.string().nullable(), sentences: z.number(), moments: z.number(), caption: z.string().nullable(), firstWords: z.string().nullable(), dayId: z.number() })),
    skipped: z.array(z.string()),
  }),
  execute: async ({ limit }) => {
    const inboxId = process.env.AGENTMAIL_INBOX;
    if (!inboxId || !process.env.AGENTMAIL_API_KEY) throw new Error("AGENTMAIL_INBOX / AGENTMAIL_API_KEY missing");
    const client = new AgentMailClient({ apiKey: process.env.AGENTMAIL_API_KEY });
    const page = await client.inboxes.messages.list(inboxId, { limit });
    const msgs = (page as unknown as { messages?: { messageId: string; from: string; subject?: string; labels?: string[] }[] }).messages ?? [];
    const ingested: Ingested[] = [];
    const skipped: string[] = [];
    const folder = todayFolder();
    await mkdir(folder, { recursive: true });

    for (const m of msgs) {
      if (processed.has(m.messageId) || m.labels?.includes("ingested")) continue;
      const full = (await client.inboxes.messages.get(inboxId, m.messageId)) as unknown as { attachments?: { attachmentId: string; filename?: string; contentType?: string; size?: number }[]; from: string; subject?: string };
      const videos = (full.attachments ?? []).filter((a) => VIDEO_TYPES.has(a.contentType ?? "") || /\.(mp4|mov|m4v)$/i.test(a.filename ?? ""));
      if (!videos.length) {
        skipped.push(`${m.subject ?? "(no subject)"} from ${m.from}: no video attachment`);
        processed.add(m.messageId);
        continue;
      }
      for (const a of videos) {
        const att = (await client.inboxes.messages.getAttachment(inboxId, m.messageId, a.attachmentId)) as unknown as { downloadUrl: string };
        const res = await fetch(att.downloadUrl); // signed cdn URL, ~1 h; fetched immediately, never stored
        if (!res.ok) { skipped.push(`${a.filename}: download ${res.status}`); continue; }
        const safe = (a.filename ?? `clip-${Date.now()}.mp4`).replace(/[^\w.\-]+/g, "_");
        const target = path.join(folder, `${m.messageId.slice(-6)}_${safe}`);
        await writeFile(target, Buffer.from(await res.arrayBuffer()));
        const r = await ingestClip(target, { dayTitle: `Inbox ${path.basename(folder).slice(6)}`, source: "agentmail" });
        ingested.push({ from: full.from, subject: full.subject ?? "", file: r.file, tag: r.tag, durationSecs: r.durationSecs, language: r.language, sentences: r.sentences, moments: r.moments, caption: r.caption, firstWords: r.firstWords, dayId: r.dayId });
      }
      try { await client.inboxes.messages.update(inboxId, m.messageId, { addLabels: ["ingested"] }); } catch { /* labels are best-effort */ }
      processed.add(m.messageId);
    }
    return { inbox: inboxId, checked: msgs.length, ingested, skipped };
  },
});
