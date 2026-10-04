// One place decides which model path the app uses.
// Neon AI Gateway when its two env vars are set (paid plan), Anthropic directly otherwise.
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";

export const MODEL_IDS = {
  director: "claude-sonnet-5-5", // writes and revises scripts
  fast: "claude-haiku-4-5", // classification, rule extraction
} as const;

export function gatewayConfigured(): boolean {
  return Boolean(process.env.NEON_AI_GATEWAY_BASE_URL && process.env.NEON_AI_GATEWAY_TOKEN);
}

/** AI SDK model for use inside tools. */
export function model(kind: keyof typeof MODEL_IDS = "director"): LanguageModel {
  const id = MODEL_IDS[kind];
  if (gatewayConfigured()) {
    // The gateway is OpenAI-compatible: base URL has no path, /v1 is appended here.
    const openai = createOpenAI({
      apiKey: process.env.NEON_AI_GATEWAY_TOKEN,
      baseURL: `${process.env.NEON_AI_GATEWAY_BASE_URL}/v1`,
    });
    return openai.chat(id);
  }
  return createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY })(id);
}

/** Mastra model router string for the chat agent. */
export function mastraModelId(kind: keyof typeof MODEL_IDS = "director"): string {
  return `${gatewayConfigured() ? "neon" : "anthropic"}/${MODEL_IDS[kind]}`;
}

export function llmPathLabel(): string {
  return gatewayConfigured() ? "Neon AI Gateway" : "Anthropic direct";
}
