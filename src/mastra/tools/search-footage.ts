import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { searchFootage, searchPictures } from "@/lib/search";

export const searchFootageTool = createTool({
  id: "search_footage",
  description:
    "Search everything the owner and his family said on camera (hybrid: meaning + keywords, in Neon) AND what the camera saw (captions of each clip's best frame). Use it for 'find the moment where…', 'what did we say about…', or to collect moments for a film ('ролик для бабушки про дочку'). Returns clip tags, seconds and the sentences, which can be passed to write_script as focus.",
  inputSchema: z.object({
    query: z.string().describe("natural language, Russian or English"),
    dayId: z.number().optional().describe("restrict to one day; omit to search the whole archive"),
    k: z.number().default(12),
  }),
  outputSchema: z.object({
    query: z.string(),
    hits: z.array(
      z.object({
        clipTag: z.string(),
        dayId: z.number(),
        dayTitle: z.string(),
        idx: z.number(),
        text: z.string(),
        startSecs: z.number(),
        endSecs: z.number(),
        shotAt: z.string().nullable(),
        language: z.string().nullable(),
        score: z.number(),
        via: z.string(),
        ref: z.string().describe("clipTag:idx — use these in write_script.focus"),
      }),
    ),
    pictures: z.array(
      z.object({ clipTag: z.string(), dayTitle: z.string(), startSecs: z.number(), caption: z.string(), shotAt: z.string().nullable() }),
    ).describe("clips whose picture matches, for show/walk shots"),
  }),
  execute: async ({ query, dayId, k }) => {
    const [hits, pictures] = await Promise.all([searchFootage(query, { k, dayId }), searchPictures(query, { k: 6, dayId })]);
    return { query, hits: hits.map((h) => ({ ...h, ref: `${h.clipTag}:${h.idx}` })), pictures };
  },
});
