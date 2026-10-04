// The taste graph. A correction from the owner becomes a durable rule the director obeys from now on.
import { createTool } from "@mastra/core/tools";
import { Output, generateText } from "ai";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { model } from "@/lib/llm";

const CATEGORIES = ["hook", "speech", "cutaway", "pacing", "cover", "copy", "music", "other"] as const;

export const listRules = createTool({
  id: "list_rules",
  description: "List the owner's standing editing rules (the taste the director must obey).",
  inputSchema: z.object({}),
  outputSchema: z.object({
    rules: z.array(z.object({ id: z.number(), category: z.string(), text: z.string(), source: z.string().nullable(), createdAt: z.string() })),
  }),
  execute: async () => {
    const rs = await db.select().from(schema.rules).where(eq(schema.rules.active, true)).orderBy(schema.rules.id);
    return { rules: rs.map((r) => ({ id: r.id, category: r.category, text: r.text, source: r.source, createdAt: r.createdAt.toISOString() })) };
  },
});

export const learnRule = createTool({
  id: "learn_rule",
  description:
    "Turn the owner's correction (his own words) into a durable editing rule and store it. Call this whenever the owner criticises a cut; then revise the script with write_script(feedback=...).",
  inputSchema: z.object({
    quote: z.string().describe("the owner's words, verbatim"),
    scriptId: z.number().optional().describe("the script the feedback was about"),
  }),
  outputSchema: z.object({ ruleId: z.number(), category: z.string(), text: z.string(), quote: z.string() }),
  execute: async ({ quote, scriptId }) => {
    const { output } = await generateText({
      model: model("fast"),
      output: Output.object({
        schema: z.object({
          category: z.enum(CATEGORIES),
          text: z.string().describe("the rule as one imperative English sentence a film editor can apply every time"),
        }),
      }),
      prompt: `An owner reviewing his own travel trailer said: "${quote}"\nState the general editing rule behind this remark (not the one-off fix). English, one sentence, imperative.`,
    });
    const [rule] = await db.insert(schema.rules).values({ text: output.text, category: output.category, source: quote }).returning();
    await db.insert(schema.feedback).values({ scriptId: scriptId ?? null, text: quote, ruleId: rule.id });
    return { ruleId: rule.id, category: rule.category, text: rule.text, quote };
  },
});
