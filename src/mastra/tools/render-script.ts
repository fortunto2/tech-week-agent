// Start a render in the background and return at once; the chat card polls /api/renders/<id> until the
// player can appear. The agent must not wait: it tells the owner the cut is rendering and moves on.
import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { renderStatus, startRender } from "@/lib/render";

export const renderScript = createTool({
  id: "render_script",
  description: "Start rendering a saved script to an mp4 (vlog_cut + video-analyzer on this Mac). Returns immediately with status 'rendering'; the UI card shows progress and the player when done (1–3 min). Do not call it again for the same script unless the owner asks.",
  inputSchema: z.object({ scriptId: z.number(), kind: z.enum(["trailer", "episode"]).default("trailer") }),
  outputSchema: z.object({
    renderId: z.number(),
    status: z.string(),
    mediaUrl: z.string().nullable(),
    posterUrl: z.string().nullable(),
    durationSecs: z.number().nullable(),
    progress: z.string(),
  }),
  execute: async ({ scriptId, kind }) => {
    const { renderId } = await startRender(scriptId, kind);
    const s = await renderStatus(renderId);
    return s ?? { renderId, status: "rendering", mediaUrl: null, posterUrl: null, durationSecs: null, progress: "queued" };
  },
});

export const getRender = createTool({
  id: "render_status",
  description: "Check a render by id: status (rendering/done/failed), progress lines, media URL when done.",
  inputSchema: z.object({ renderId: z.number() }),
  outputSchema: z.object({
    renderId: z.number(),
    status: z.string(),
    mediaUrl: z.string().nullable(),
    posterUrl: z.string().nullable(),
    durationSecs: z.number().nullable(),
    progress: z.string(),
  }).nullable(),
  execute: async ({ renderId }) => renderStatus(renderId),
});
