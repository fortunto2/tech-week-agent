// YouTube-ready copy for a cut: title, hook paragraph, chapters with timecodes, tags — in the owner's voice,
// with the facts (venue, event, who was on stage) looked up through Exa so names and places are right.
import { createTool } from "@mastra/core/tools";
import { Output, generateText } from "ai";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { importAtRuntime } from "@/lib/dynamic-import";
import { keyFrom, model } from "@/lib/llm";
import type { Script } from "@/lib/script-schema";

async function exaFacts(query: string): Promise<{ title: string; url: string; snippet: string }[]> {
  if (!process.env.EXA_API_KEY) return [];
  try {
    const { default: Exa } = await importAtRuntime<{ default: new (k?: string) => { search: (q: string, o: Record<string, unknown>) => Promise<{ results: { title?: string; url: string; highlights?: string[]; text?: string }[] }> } }>("exa-js");
    const exa = new Exa(process.env.EXA_API_KEY);
    const r = await exa.search(query, { type: "auto", numResults: 5, contents: { highlights: true } });
    return r.results.map((x) => ({ title: x.title ?? "", url: x.url, snippet: (x.highlights?.[0] ?? x.text ?? "").slice(0, 300) }));
  } catch (e) {
    console.error("[exa]", e instanceof Error ? e.message : e);
    return [];
  }
}

export const describeFilm = createTool({
  id: "describe_film",
  description: "Write the YouTube title, description with chapters, and tags for a rendered film, in the owner's voice; looks up places/events/people with Exa so the facts are right. Call after render_script.",
  inputSchema: z.object({ scriptId: z.number(), language: z.enum(["ru", "en"]).default("ru") }),
  outputSchema: z.object({
    title: z.string(),
    description: z.string(),
    chapters: z.array(z.object({ at: z.string(), name: z.string() })),
    tags: z.array(z.string()),
    facts: z.array(z.object({ title: z.string(), url: z.string() })),
  }),
  execute: async ({ scriptId, language }, options) => {
    const script = await db.query.scripts.findFirst({ where: eq(schema.scripts.id, scriptId) });
    if (!script) throw new Error(`script ${scriptId} not found`);
    const day = await db.query.days.findFirst({ where: eq(schema.days.id, script.dayId) });
    const body = script.body as Script;
    const notes = body.shots.map((s, i) => `${i + 1}. ${s.note ?? ""}`).join("\n");
    const factsQuery = `${day?.title ?? ""} ${body._}`.slice(0, 200);
    const facts = await exaFacts(factsQuery);
    const { output } = await generateText({
      model: model("director", keyFrom(options)),
      output: Output.object({
        schema: z.object({
          title: z.string().describe("≤ 70 chars, about the whole day, no clickbait"),
          description: z.string().describe("hook paragraph in the owner's first-person voice, then one line per chapter"),
          chapters: z.array(z.object({ at: z.string().describe("m:ss"), name: z.string() })),
          tags: z.array(z.string()).max(15),
        }),
      }),
      prompt: [
        `Write YouTube copy in ${language === "ru" ? "Russian" : "English"} for a personal travel vlog cut by the owner's agent.`,
        `Day: ${day?.title ?? ""}. Film: ${body._}`,
        `Shot notes in order (chapters follow these, assume ~6 s per shot for timecodes):`,
        notes,
        facts.length ? `Verified facts from the web (use names and places exactly as given):\n${facts.map((f) => `- ${f.title}: ${f.snippet} (${f.url})`).join("\n")}` : ``,
        `Voice: first person, warm, specific, no marketing words. End the description with: "Edited automatically by Life2Film Director."`,
      ].join("\n\n"),
    });
    return { ...output, facts: facts.map((f) => ({ title: f.title, url: f.url })) };
  },
});
