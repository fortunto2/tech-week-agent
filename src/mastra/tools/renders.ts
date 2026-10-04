import { createTool } from "@mastra/core/tools";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";

export const listRenders = createTool({
  id: "list_renders",
  description: "List the films already rendered (newest first) with their script version, day and player URL.",
  inputSchema: z.object({ limit: z.number().default(6) }),
  outputSchema: z.object({
    renders: z.array(
      z.object({
        renderId: z.number(),
        scriptId: z.number(),
        version: z.number(),
        dayTitle: z.string(),
        about: z.string(),
        kind: z.string(),
        status: z.string(),
        durationSecs: z.number().nullable(),
        mediaUrl: z.string().nullable(),
        createdAt: z.string(),
      }),
    ),
  }),
  execute: async ({ limit }) => {
    const rows = await db
      .select({ r: schema.renders, s: schema.scripts, d: schema.days })
      .from(schema.renders)
      .innerJoin(schema.scripts, eq(schema.scripts.id, schema.renders.scriptId))
      .innerJoin(schema.days, eq(schema.days.id, schema.scripts.dayId))
      .orderBy(desc(schema.renders.id))
      .limit(limit);
    return {
      renders: rows.map(({ r, s, d }) => ({
        renderId: r.id,
        scriptId: s.id,
        version: s.version,
        dayTitle: d.title,
        about: (s.body as { _?: string })._ ?? "",
        kind: r.kind,
        status: r.status,
        durationSecs: r.durationSecs,
        mediaUrl: r.status === "done" && r.path ? `/api/media?path=${encodeURIComponent(r.path)}` : null,
        createdAt: r.createdAt.toISOString(),
      })),
    };
  },
});
