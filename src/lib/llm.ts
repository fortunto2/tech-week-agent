// One place decides which model path the app uses, in this order:
//   Neon AI Gateway (both NEON_* set, paid plan) → Anthropic direct → OpenAI direct.
// The same choice feeds Mastra's model router string and the AI SDK models used inside tools.
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";

type Kind = "director" | "fast";

const IDS: Record<"neon" | "anthropic" | "openai", Record<Kind, string>> = {
  neon: { director: "claude-sonnet-5-5", fast: "claude-haiku-4-5" },
  anthropic: { director: "claude-sonnet-5-5", fast: "claude-haiku-4-5" },
  openai: { director: "gpt-5.5", fast: "gpt-5.4-mini" },
};

/** The visitor's own OpenAI key (hosted demo, header x-openai-key) wins over anything in the environment. */
export const NO_KEY_MESSAGE = "No LLM key: add your OpenAI API key (top right) — it stays in your browser and is sent only with your requests.";

export function provider(userKey?: string | null): "neon" | "anthropic" | "openai" {
  if (userKey) return "openai";
  if (process.env.NEON_AI_GATEWAY_BASE_URL && process.env.NEON_AI_GATEWAY_TOKEN) return "neon";
  if (process.env.ANTHROPIC_API_KEY) return "anthropic";
  if (process.env.OPENAI_API_KEY) return "openai";
  throw new Error(NO_KEY_MESSAGE);
}

export function openaiKey(userKey?: string | null): string {
  const k = userKey || process.env.OPENAI_API_KEY;
  if (!k) throw new Error(NO_KEY_MESSAGE);
  return k;
}

/** AI SDK model for use inside tools. */
export function model(kind: Kind = "director", userKey?: string | null): LanguageModel {
  const p = provider(userKey);
  const id = IDS[p][kind];
  if (p === "neon") {
    // OpenAI-compatible gateway: base URL has no path, /v1 is appended here.
    return createOpenAI({ apiKey: process.env.NEON_AI_GATEWAY_TOKEN, baseURL: `${process.env.NEON_AI_GATEWAY_BASE_URL}/v1` }).chat(id);
  }
  if (p === "anthropic") return createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY })(id);
  return createOpenAI({ apiKey: openaiKey(userKey) })(id);
}

/** Pull the visitor's key out of a Mastra tool/agent request context. */
export const keyFrom = (ctx: unknown): string | undefined => {
  const rc = (ctx as { requestContext?: { get?: (k: string) => unknown } | Record<string, unknown> } | undefined)?.requestContext;
  if (!rc) return undefined;
  const v = typeof (rc as { get?: unknown }).get === "function" ? (rc as { get: (k: string) => unknown }).get("openaiKey") : (rc as Record<string, unknown>).openaiKey;
  return typeof v === "string" && v ? v : undefined;
};

/** Mastra model router string for the chat agent (`provider/model`). */
export function mastraModelId(kind: Kind = "director"): string {
  const p = provider();
  return `${p}/${IDS[p][kind]}`;
}

/** Dynamic Mastra model config: the visitor's key when present, the environment's provider otherwise. */
export function dynamicModel(kind: Kind = "director") {
  return (ctx: { requestContext?: unknown }): string | { id: `${string}/${string}`; apiKey?: string } => {
    const k = keyFrom(ctx);
    if (k) return { id: `openai/${IDS.openai[kind]}`, apiKey: k };
    return mastraModelId(kind);
  };
}

export function llmPathLabel(): string {
  return { neon: "Neon AI Gateway", anthropic: "Anthropic direct", openai: "OpenAI direct" }[provider()];
}
