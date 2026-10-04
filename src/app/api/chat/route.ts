// Mastra director agent → AI SDK v7 UI message stream → assistant-ui.
import { handleChatStream, withSseHeartbeat } from "@mastra/ai-sdk";
import { createUIMessageStreamResponse, type UIMessage } from "ai";
import { mastra } from "@/mastra";

export const maxDuration = 600; // renders run inside a tool call

export async function POST(req: Request) {
  const { messages, threadId } = (await req.json()) as { messages: UIMessage[]; threadId?: string };
  const stream = await handleChatStream<UIMessage>({
    mastra,
    agentId: "director",
    version: "v7",
    params: { messages, memory: { thread: threadId ?? "owner-main", resource: "owner" } },
  });
  return withSseHeartbeat(createUIMessageStreamResponse({ stream }), 15000);
}
