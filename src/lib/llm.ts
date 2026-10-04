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

export function provider(): "neon" | "anthropic" | "openai" {
  if (process.env.NEON_AI_GATEWAY_BASE_URL && process.env.NEON_AI_GATEWAY_TOKEN) return "neon";
  if (process.env.ANTHROPIC_API_KEY) return "anthropic";
  if (process.env.OPENAI_API_KEY) return "openai";
  throw new Error("No LLM credentials: set NEON_AI_GATEWAY_* or ANTHROPIC_API_KEY or OPENAI_API_KEY");
}

/** AI SDK model for use inside tools. */
export function model(kind: Kind = "director"): LanguageModel {
  const p = provider();
  const id = IDS[p][kind];
  if (p === "neon") {
    // OpenAI-compatible gateway: base URL has no path, /v1 is appended here.
    return createOpenAI({ apiKey: process.env.NEON_AI_GATEWAY_TOKEN, baseURL: `${process.env.NEON_AI_GATEWAY_BASE_URL}/v1` }).chat(id);
  }
  if (p === "anthropic") return createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY })(id);
  return createOpenAI({ apiKey: process.env.OPENAI_API_KEY })(id);
}

/** Mastra model router string for the chat agent (`provider/model`). */
export function mastraModelId(kind: Kind = "director"): string {
  const p = provider();
  return `${p}/${IDS[p][kind]}`;
}

export function llmPathLabel(): string {
  return { neon: "Neon AI Gateway", anthropic: "Anthropic direct", openai: "OpenAI direct" }[provider()];
}
