"use client";
import { AssistantChatTransport, useChatRuntime } from "@assistant-ui/ai-sdk";
import { AssistantRuntimeProvider, AuiConfig, Tools } from "@assistant-ui/react";
import { Thread } from "@/components/assistant-ui/elements/thread.aui";
import { useEffect, useState } from "react";
import { ApiKeyField, getStoredKey } from "@/components/api-key";
import { UploadAnalyze } from "@/components/upload-analyze";
import { toolkit } from "./tool-ui";

const BYOK = process.env.NEXT_PUBLIC_LOCAL_TOOLS === "0"; // hosted demo: the visitor brings an OpenAI key

const config = AuiConfig({ tools: Tools({ toolkit }) }); // module scope: referentially stable

export default function Home() {
  const [key, setKey] = useState("");
  useEffect(() => {
    const t = setInterval(() => setKey((k) => { const v = getStoredKey(); return v === k ? k : v; }), 300); // picks up a key typed in the header field
    return () => clearInterval(t);
  }, []);
  const runtime = useChatRuntime({ transport: new AssistantChatTransport({ api: "/api/chat", headers: key ? { "x-openai-key": key } : undefined }) });
  return (
    <AssistantRuntimeProvider runtime={runtime} config={config}>
      <main className="mx-auto flex h-dvh max-w-3xl flex-col">
        <header className="flex items-baseline justify-between border-b border-border px-4 py-2">
          <h1 className="text-base font-semibold">Life2Film Director</h1>
          <div className="flex items-center gap-3">
            <span className="hidden text-xs text-muted-foreground sm:inline">your footage → searchable memory → cuts by your rules</span>
            {BYOK && <ApiKeyField />}
          </div>
        </header>
        <UploadAnalyze />
        <div className="min-h-0 flex-1">
          <Thread />
        </div>
      </main>
    </AssistantRuntimeProvider>
  );
}
