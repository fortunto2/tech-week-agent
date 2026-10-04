import { createTool } from "@mastra/core/tools";
import { desc } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { daySummary } from "@/lib/day-text";

export const listDays = createTool({
  id: "list_days",
  description: "List the footage days the agent knows (ingested folders) with clip counts, languages and dates.",
  inputSchema: z.object({}),
  outputSchema: z.object({
    days: z.array(
      z.object({
        dayId: z.number(),
        title: z.string(),
        folder: z.string(),
        clips: z.number(),
        withSpeech: z.number(),
        languages: z.record(z.string(), z.number()),
        shotFrom: z.string().nullable(),
        shotTo: z.string().nullable(),
        totalMinutes: z.number(),
      }),
    ),
  }),
  execute: async () => {
    const rows = await db.select({ id: schema.days.id }).from(schema.days).orderBy(desc(schema.days.id));
    const days = [];
    for (const r of rows) {
      const s = await daySummary(r.id);
      if (s) days.push(s);
    }
    return { days };
  },
});
