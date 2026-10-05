// Mastra director agent → AI SDK v7 UI message stream → assistant-ui.
import { handleChatStream, withSseHeartbeat } from "@mastra/ai-sdk";
import { createUIMessageStreamResponse, type UIMessage } from "ai";
import { RequestContext } from "@mastra/core/request-context";
import { NO_KEY_MESSAGE, provider } from "@/lib/llm";
import { mastra } from "@/mastra";

export const maxDuration = 600; // renders run inside a tool call

export async function POST(req: Request) {
  const { messages, threadId } = (await req.json()) as { messages: UIMessage[]; threadId?: string };
  const openaiKey = req.headers.get("x-openai-key")?.trim() || undefined; // the visitor's own key (hosted demo)
  try {
    provider(openaiKey); // no visitor key and no server key → tell the visitor instead of a bare 500
  } catch {
    return new Response(NO_KEY_MESSAGE, { status: 402 });
  }
  const requestContext = new RequestContext();
  if (openaiKey) requestContext.set("openaiKey", openaiKey);
  const stream = await handleChatStream<UIMessage>({
    mastra,
    agentId: "director",
    version: "v7",
    params: { messages, memory: { thread: threadId ?? "owner-main", resource: "owner" }, requestContext },
  });
  return withSseHeartbeat(createUIMessageStreamResponse({ stream: stream as unknown as ReadableStream<never> }), 15000);
}
