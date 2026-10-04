"use client";
// Toolkit keys MUST equal the Mastra tool keys / ids, or the cards never render.
import { defineToolkit } from "@assistant-ui/react";
import { DaysCard, InboxCard, RenderCard, RuleCard, RulesCard, ScriptCard, SearchCard } from "@/components/tool-ui/cards";

const Running = ({ label }: { label: string }) => <p className="my-2 animate-pulse text-sm text-muted-foreground">{label}</p>;
const Failed = ({ reason }: { reason: string }) => <p className="my-2 text-sm text-destructive">Failed: {reason}</p>;

export const toolkit = defineToolkit({
  list_days: {
    type: "backend",
    display: "standalone",
    render: ({ result, status }) => {
      if (status.type === "running") return <Running label="Reading the footage index…" />;
      if (status.type === "incomplete") return <Failed reason={String(status.reason)} />;
      return <DaysCard days={(result as { days: never[] })?.days ?? []} />;
    },
  },
  search_footage: {
    type: "backend",
    display: "standalone",
    render: ({ args, result, status }) => {
      if (status.type === "running") return <Running label={`Searching the archive: ${(args as { query?: string })?.query ?? ""}…`} />;
      if (status.type === "incomplete") return <Failed reason={String(status.reason)} />;
      return result ? <SearchCard r={result as never} /> : null;
    },
  },
  check_inbox: {
    type: "backend",
    display: "standalone",
    render: ({ result, status }) => {
      if (status.type === "running") return <Running label="Checking the agent's inbox, ingesting new clips (engine + whisper)…" />;
      if (status.type === "incomplete") return <Failed reason={String(status.reason)} />;
      return result ? <InboxCard r={result as never} /> : null;
    },
  },
  write_script: {
    type: "backend",
    display: "standalone",
    render: ({ args, result, status }) => {
      if (status.type === "running") return <Running label={`Writing the script: ${(args as { brief?: string })?.brief ?? ""}…`} />;
      if (status.type === "incomplete") return <Failed reason={String(status.reason)} />;
      return result ? <ScriptCard r={result as never} /> : null;
    },
  },
  render_script: {
    type: "backend",
    display: "standalone",
    render: ({ result, status }) => {
      if (status.type === "running") return <Running label="Rendering on the Mac (vlog_cut → video-analyzer)… 1–3 min" />;
      if (status.type === "incomplete") return <Failed reason={String(status.reason)} />;
      return result ? <RenderCard r={result as never} /> : null;
    },
  },
  learn_rule: {
    type: "backend",
    display: "standalone",
    render: ({ result, status }) => {
      if (status.type === "running") return <Running label="Turning that into a rule…" />;
      if (status.type === "incomplete") return <Failed reason={String(status.reason)} />;
      return result ? <RuleCard r={result as never} /> : null;
    },
  },
  list_rules: {
    type: "backend",
    display: "standalone",
    render: ({ result, status }) => {
      if (status.type === "running") return <Running label="Loading rules…" />;
      if (status.type === "incomplete") return <Failed reason={String(status.reason)} />;
      return <RulesCard rules={(result as { rules: never[] })?.rules ?? []} />;
    },
  },
});
