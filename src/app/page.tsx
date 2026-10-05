"use client";
import { AssistantChatTransport, useChatRuntime } from "@assistant-ui/ai-sdk";
import { AssistantRuntimeProvider, AuiConfig, Tools } from "@assistant-ui/react";
import { Thread } from "@/components/assistant-ui/elements/thread.aui";
import { UploadAnalyze } from "@/components/upload-analyze";
import { toolkit } from "./tool-ui";

const config = AuiConfig({ tools: Tools({ toolkit }) }); // module scope: referentially stable

export default function Home() {
  const runtime = useChatRuntime({ transport: new AssistantChatTransport({ api: "/api/chat" }) });
  return (
    <AssistantRuntimeProvider runtime={runtime} config={config}>
      <main className="mx-auto flex h-dvh max-w-3xl flex-col">
        <header className="flex items-baseline justify-between border-b border-border px-4 py-2">
          <h1 className="text-base font-semibold">Life2Film Director</h1>
          <span className="text-xs text-muted-foreground">your footage → searchable memory → cuts by your rules</span>
        </header>
        <UploadAnalyze />
        <div className="min-h-0 flex-1">
          <Thread />
        </div>
      </main>
    </AssistantRuntimeProvider>
  );
}
