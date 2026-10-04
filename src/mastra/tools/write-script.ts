// The director's core move: read the whole day, obey the owner's rules, write script.json.
// One model call with structured output; the chat agent stays light and only orchestrates.
import { createTool } from "@mastra/core/tools";
import { Output, generateText } from "ai";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { dayText } from "@/lib/day-text";
import { model } from "@/lib/llm";
import { SCRIPT_FORMAT_DOC, ScriptSchema, type Script } from "@/lib/script-schema";
import { validateScriptAgainstDay } from "@/lib/script-validate";

export async function activeRulesText(): Promise<string> {
  const rs = await db.select().from(schema.rules).where(eq(schema.rules.active, true)).orderBy(schema.rules.id);
  return rs.map((r, i) => `${i + 1}. [${r.category}] ${r.text}`).join("\n");
}

function directorPrompt(args: { brief: string; rules: string; day: string; previous?: Script; feedback?: string; targetSecs: number }) {
  const { brief, rules, day, previous, feedback, targetSecs } = args;
  return [
    `You are the owner's personal film director. You write a trailer script for one day (or week) of travel footage.`,
    `The owner's standing rules, learned from his own corrections. Every one of them is binding:`,
    rules,
    ``,
    `Target length ≈ ${targetSecs} seconds of speech plus walks. Three acts, each with 3+ scenes, in day order.`,
    `Open cold (4–6 strongest silent frames, 1.5–1.8 s each) then ONE hook line with tension or a promise, then the story.`,
    `"say" spans must end on the last meaningful word; prefer whole emotional thoughts over fragments.`,
    `Cutaways ("show") come from a clip shot within ~8 minutes of the line and show what is being said.`,
    `Walks ("walk") are 10–20 s from clips that have NO speech. Last shot of the film is a walk alone.`,
    `Notes are short, in the owner's language (Russian), and say why the shot is there (e.g. "ХУК: …", "I ДОЛИНА · …").`,
    ``,
    `Output exactly this JSON shape, nothing else:`,
    SCRIPT_FORMAT_DOC,
    ``,
    previous ? `Previous version of the script:\n${JSON.stringify(previous)}\n` : ``,
    feedback ? `The owner's feedback on it (apply it, change as little else as possible):\n${feedback}\n` : ``,
    `Brief from the owner: ${brief}`,
    ``,
    `THE DAY (clip tag · time · language · length, then numbered sentences with start seconds):`,
    day,
  ].join("\n");
}

export const writeScript = createTool({
  id: "write_script",
  description:
    "Write a trailer script (script.json) for a day: reads the whole day text and the owner's rules, returns the saved script version with its shots. Use revise=true with feedback to produce the next version of the latest script.",
  inputSchema: z.object({
    dayId: z.number().describe("from list_days"),
    brief: z.string().describe("what the owner asked for, e.g. 'трейлер недели в долине, 3 минуты, темп трейлерный'"),
    targetSecs: z.number().default(180),
    feedback: z.string().optional().describe("owner's correction to apply to the latest script"),
  }),
  outputSchema: z.object({
    scriptId: z.number(),
    version: z.number(),
    about: z.string(),
    shots: z.number(),
    sayLines: z.number(),
    walks: z.number(),
    openFrames: z.number(),
    problems: z.array(z.string()),
    script: z.any(),
  }),
  execute: async ({ dayId, brief, targetSecs, feedback }) => {
    const [rules, day] = await Promise.all([activeRulesText(), dayText(dayId)]);
    const latest = await db.query.scripts.findFirst({ where: eq(schema.scripts.dayId, dayId), orderBy: desc(schema.scripts.version) });
    const previous = feedback && latest ? (latest.body as Script) : undefined;

    const { output } = await generateText({
      model: model("director"),
      output: Output.object({ schema: ScriptSchema }),
      prompt: directorPrompt({ brief, rules, day: day.text, previous, feedback, targetSecs }),
      maxOutputTokens: 8000,
    });
    const script = output as Script;
    const problems = await validateScriptAgainstDay(dayId, script);

    const version = (latest?.version ?? 0) + 1;
    const [row] = await db
      .insert(schema.scripts)
      .values({ dayId, version, brief: feedback ? `${brief}\n\nfeedback: ${feedback}` : brief, body: script })
      .returning();
    if (feedback) await db.insert(schema.feedback).values({ scriptId: row.id, text: feedback });

    return {
      scriptId: row.id,
      version,
      about: script._,
      shots: script.shots.length,
      sayLines: script.shots.filter((s) => s.say).length,
      walks: script.shots.filter((s) => s.walk !== undefined).length,
      openFrames: script.open?.shots.length ?? 0,
      problems,
      script,
    };
  },
});

export const getScript = createTool({
  id: "get_script",
  description: "Return a saved script by id (or the latest for a day).",
  inputSchema: z.object({ scriptId: z.number().optional(), dayId: z.number().optional() }),
  outputSchema: z.object({ scriptId: z.number(), dayId: z.number(), version: z.number(), script: z.any() }).nullable(),
  execute: async ({ scriptId, dayId }) => {
    const row = scriptId
      ? await db.query.scripts.findFirst({ where: eq(schema.scripts.id, scriptId) })
      : dayId
        ? await db.query.scripts.findFirst({ where: and(eq(schema.scripts.dayId, dayId)), orderBy: desc(schema.scripts.version) })
        : undefined;
    return row ? { scriptId: row.id, dayId: row.dayId, version: row.version, script: row.body } : null;
  },
});
