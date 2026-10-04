# Dev recipe — Tech Week Agent (4 Oct 2026)

Source of truth: the sponsor skills in `~/.claude/skills/` (assistant-ui `setup/tools`, `mastra`, `neon*`,
`kernel-typescript-sdk`, `agentmail`, `build-with-exa`, `sprites`, `next-best-practices`) plus the pages they point
to (mastra.ai `*.md`, neon.com drizzle guide, fly.io Next.js guide). Where a skill and `docs/plan.md` disagree,
this file wins. Anything a skill does not cover is marked **UNVERIFIED**.

## 0. Version drift to respect

- `ai@^7` + `@ai-sdk/react@^4` (required by `@assistant-ui/ai-sdk`; `react-ai-sdk` is the legacy re-export). `convertToModelMessages` is async in v7.
- `@mastra/ai-sdk` defaults to the AI SDK **v5** stream contract. Always pass `version: 'v7'`.
- `defineToolkit` + `AuiConfig`/`Tools`, not `makeAssistantToolUI`. Styled components: `@/components/assistant-ui/elements/thread.aui`.
- Mastra wants ESM (`module: esnext`, `moduleResolution: bundler`), `zod@^4`, Node 22.13+.
- React 19 / Next 16 peer-dep conflicts: **UNVERIFIED** (no skill mentions them). If `pnpm add` complains, use `--strict-peer-dependencies=false`, don't downgrade `ai`.

## 1. Scaffold (in order)

```bash
# 1. Next.js (flags from the Mastra Next.js guide; keep the @/ alias because assistant-ui init expects it)
pnpm dlx create-next-app@latest tech-week-agent --yes --ts --eslint --tailwind --src-dir --app --turbopack --no-react-compiler --import-alias "@/*"
cd tech-week-agent

# 2. assistant-ui into the existing app (-y for non-TTY). Adds @assistant-ui/react, @assistant-ui/ai-sdk, ai@^7, @ai-sdk/react@^4, the Thread element.
npx assistant-ui@latest init -y     # if it skipped any: pnpm add @assistant-ui/react @assistant-ui/ai-sdk ai@^7 @ai-sdk/react@^4 zod@^4
npx assistant-ui@latest add thread tool-fallback tool-group && npx assistant-ui@latest doctor

# 3. Mastra (full-stack in-process; no separate server)
pnpm add @mastra/core@latest @mastra/ai-sdk@latest @mastra/memory@latest @mastra/pg@latest
pnpm add -D mastra@latest            # only for `mastra dev` Studio on :4111 (optional)

# 4. Neon + drizzle
pnpm add drizzle-orm @neondatabase/serverless dotenv
pnpm add -D drizzle-kit

# 5. LLM providers
pnpm add @neon/ai-sdk-provider        # Neon AI Gateway via AI SDK (zero config from NEON_AI_GATEWAY_*)
pnpm add @ai-sdk/anthropic            # fallback; import shape by analogy with @ai-sdk/openai — UNVERIFIED

# 6. Sponsors
pnpm add exa-js @onkernel/sdk playwright-core agentmail svix
```

`neon` CLI: `pnpm add -g neon; neon link --project-id <id> -y` writes `.neon` and pulls `DATABASE_URL` +
`DATABASE_URL_UNPOOLED` into `.env.local` (`neon env pull` refreshes). Project region **aws-us-east-2** (AI Gateway: us-east-2/us-east-1/eu-central-1/ap-southeast-1 only).

## 2. Config files

```ts
// next.config.ts
import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  output: "standalone",                      // Fly.io Dockerfile
  serverExternalPackages: ["@mastra/*"],     // required; otherwise opaque bundling errors at request time
};
export default nextConfig;
// Only wrap with withAui() from @assistant-ui/next if you use "use generative" toolkit files. We don't.
```

```ts
// drizzle.config.ts  (Neon drizzle guide; migrations need the UNPOOLED url)
import { config } from "dotenv";
config({ path: ".env.local" });
import { defineConfig } from "drizzle-kit";
if (!process.env.DATABASE_URL_UNPOOLED) throw new Error("DATABASE_URL_UNPOOLED missing");
export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL_UNPOOLED },
});
```

```env
# .env.example
DATABASE_URL=              # pooled (-pooler): app traffic + Mastra PostgresStore   | DATABASE_URL_UNPOOLED= direct: drizzle-kit only
NEON_AI_GATEWAY_BASE_URL=  # bare host, no path: https://<branch>-api.ai.<region>.aws.neon.tech | NEON_AI_GATEWAY_TOKEN= nt_live_...
ANTHROPIC_API_KEY=         # fallback model path
EXA_API_KEY=  KERNEL_API_KEY=  AGENTMAIL_API_KEY=
AGENTMAIL_INBOX_ID=        # the address itself, e.g. techweek@agentmail.to | AGENTMAIL_WEBHOOK_SECRET= whsec_... (webhook only)
```

## 3. Neon Postgres + drizzle

```ts
// src/db/index.ts  (neon-http driver: one-shot HTTP queries, fine for route handlers)
import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
const sql = neon(process.env.DATABASE_URL!);
export const db = drizzle({ client: sql });
```

```ts
// src/db/schema.ts
import { pgTable, serial, text, timestamp, integer, boolean, jsonb } from "drizzle-orm/pg-core";
export const events = pgTable("events", {
  id: serial("id").primaryKey(),
  url: text("url").notNull().unique(),
  name: text("name").notNull(),
  startsAt: timestamp("starts_at", { withTimezone: true }),
  venue: text("venue"), lat: text("lat"), lng: text("lng"),
  hosts: jsonb("hosts").$type<string[]>(),
  free: boolean("free").default(true),
  approvalRequired: boolean("approval_required").default(false),
  source: text("source"),
});
// applications: id, event_id → events.id, status (pending|approved|waitlisted|rejected|needs_human), email_message_id, screenshot_url
```

Apply: the Neon guide shows `npx drizzle-kit generate` + `npx drizzle-kit migrate`; `npx drizzle-kit push` (no
migration files) is the shortcut, not in the fetched docs. Mastra's `PostgresStore` creates its own `mastra_*`
tables in the same DB at startup; run `push` before the first boot and read any "drop table" prompt
(**UNVERIFIED** whether push offers to drop tables outside the drizzle schema).

## 4. Mastra: tool, agent, instance

```ts
// src/mastra/tools/rank-events.ts
import { createTool } from "@mastra/core/tools";
import { z } from "zod";
export const rankEvents = createTool({
  id: "rank_events",                         // keep id === object key below, so the model-visible name is unambiguous
  description: "Score events for the user's profile; returns top N with a one-line reason each.",
  inputSchema: z.object({ profile: z.string(), from: z.string(), to: z.string(), limit: z.number().default(10) }),
  outputSchema: z.object({ picks: z.array(z.object({ url: z.string(), name: z.string(), score: z.number(), reason: z.string() })) }),
  execute: async ({ profile, from, to, limit }) => ({ picks: [] }),  // SQL pre-filter, then one LLM call per 40 events (model: §4 table)
});
```

```ts
// src/mastra/agents/concierge.ts
import { Agent } from "@mastra/core/agent";
import { Memory } from "@mastra/memory";
import { rankEvents } from "../tools/rank-events";
export const concierge = new Agent({
  id: "concierge",
  name: "Tech Week Concierge",
  instructions: "You run the user's conference week. Never pay, never solve captchas, never cancel without an explicit 'cancel'.",
  model: "anthropic/claude-sonnet-4-6",      // Mastra model router string; reads ANTHROPIC_API_KEY
  tools: { rank_events: rankEvents },
  memory: new Memory({ options: { lastMessages: 20 } }),   // storage comes from the Mastra instance
});
```

```ts
// src/mastra/index.ts
import { Mastra } from "@mastra/core";
import { PostgresStore } from "@mastra/pg";
import { concierge } from "./agents/concierge";
export const mastra = new Mastra({
  agents: { concierge },
  storage: new PostgresStore({ id: "neon-storage", connectionString: process.env.DATABASE_URL! }), // pooled URL; tables auto-created
});
```

`Memory` without any storage throws "Storage is required for Memory"; the Mastra instance's storage covers it.
Memory needs a consistent thread/resource per conversation (set in the route). Studio: `pnpm mastra dev` →
http://localhost:4111, same Postgres as `next dev`, so threads and traces show up for the judges.

### Model swap

| Path | Code | Env |
|---|---|---|
| Anthropic direct (default today) | `model: "anthropic/claude-sonnet-4-6"` (`anthropic/claude-haiku-4-5` for batch ranking) | `ANTHROPIC_API_KEY` |
| Neon AI Gateway via Mastra | `model: "neon/claude-sonnet-4-6"` (needs `@mastra/core` 1.47+; goes through `/v1/chat/completions`, so no native Anthropic extras) | `NEON_AI_GATEWAY_BASE_URL`, `NEON_AI_GATEWAY_TOKEN` |
| Neon AI Gateway via AI SDK (inside a tool, e.g. ranking) | `import { neon } from "@neon/ai-sdk-provider"; generateText({ model: neon("claude-haiku-4-5"), ... })` | same |
| `@ai-sdk/openai` against the gateway | `createOpenAI({ apiKey: NEON_AI_GATEWAY_TOKEN, baseURL: \`${BASE}/openai/v1\` })` | same |
| `@ai-sdk/anthropic` fallback in a tool | `import { anthropic } from "@ai-sdk/anthropic"; anthropic("claude-opus-5-5")` (**UNVERIFIED** import shape; the Anthropic default model is `claude-opus-5-5`, Mastra's registry also lists `claude-sonnet-4-6` / `claude-haiku-4-5`) | `ANTHROPIC_API_KEY` |

Gateway catalog on this branch: `curl "$NEON_AI_GATEWAY_BASE_URL/v1/models" -H "Authorization: Bearer $NEON_AI_GATEWAY_TOKEN"`.
Paid Neon plan is a hard requirement (Free plan blocks provisioning); a paid account can still start with a
trimmed catalog, so check `/v1/models` before putting a model id in code. Mastra's `neon/` list today includes
`claude-sonnet-4-6`, `claude-haiku-4-5`, `claude-opus-5-5`, `gpt-5-mini`, `gemini-3-flash`.

## 5. Chat route (Mastra → AI SDK v7 → assistant-ui)

```ts
// src/app/api/chat/route.ts   (Mastra Next.js guide, version v7)
import { handleChatStream, withSseHeartbeat } from "@mastra/ai-sdk";
import { createUIMessageStreamResponse } from "ai";
import { mastra } from "@/mastra";

export const maxDuration = 120;

export async function POST(req: Request) {
  const { messages } = await req.json();      // AssistantChatTransport also posts `system` and `tools`; ignored here
  const stream = await handleChatStream({
    mastra,
    agentId: "concierge",                     // object key in `agents: { concierge }`
    version: "v7",
    params: { messages, memory: { thread: "demo-thread", resource: "rustam" } },
  });
  return withSseHeartbeat(createUIMessageStreamResponse({ stream }), 15000);  // keeps Fly's proxy from dropping idle streams
}
```

Lower-level equivalent if `handleChatStream` misbehaves: `const stream = await mastra.getAgent("concierge").stream(messages)`,
then `createUIMessageStream({ originalMessages: messages, execute: async ({ writer }) => { for await (const p of
toAISdkStream(stream, { from: "agent", version: "v7" })) await writer.write(p); } })` → `createUIMessageStreamResponse`.
`originalMessages` prevents duplicated assistant messages. Memory options on `agent.stream()` are **UNVERIFIED**;
`handleChatStream`'s `params.memory` is the documented shape.

## 6. assistant-ui page + tool UI

```tsx
// src/app/tool-ui.tsx   ("use client" plain toolkit: render-only entries, no compiler, no withAui)
"use client";
import { defineToolkit } from "@assistant-ui/react";
import { EventList } from "@/components/tool-ui/event-list";

export const toolkit = defineToolkit({
  rank_events: {                              // MUST equal the model-visible tool name (Mastra tool key / id)
    type: "backend",
    display: "standalone",                    // keep the card out of the collapsed tool group
    render: ({ args, result, status }) => {
      if (status.type === "running") return <p>Ranking events for {args.profile}…</p>;
      if (status.type === "incomplete") return <p>Failed: {status.reason}</p>;
      return <EventList picks={result?.picks ?? []} />;
    },
  },
  open_browser: { type: "backend", display: "standalone", render: ({ result }) => result?.liveViewUrl ? <iframe src={result.liveViewUrl} className="h-[480px] w-full" /> : <p>Opening browser…</p> },
});
```

```tsx
// src/app/page.tsx
"use client";
import { AssistantRuntimeProvider, AuiConfig, Tools } from "@assistant-ui/react";
import { useChatRuntime, AssistantChatTransport } from "@assistant-ui/ai-sdk";
import { Thread } from "@/components/assistant-ui/elements/thread.aui";
import { toolkit } from "./tool-ui";

const config = AuiConfig({ tools: Tools({ toolkit }) });   // module scope: toolkit must be referentially stable

export default function Home() {
  const runtime = useChatRuntime({ transport: new AssistantChatTransport({ api: "/api/chat" }) }); // /api/chat is the default anyway
  return (
    <AssistantRuntimeProvider runtime={runtime} config={config}>
      <div className="h-dvh"><Thread /></div>
    </AssistantRuntimeProvider>
  );
}
```

Renderer props: `args` (partial while streaming), `argsText`, `result`, `isError`, `status`
(`running | complete | incomplete{reason} | requires-action{reason}`), `toolName`, `toolCallId`. Handle every
branch; assuming `result` exists crashes on the running path. No renderer → `ToolFallback`. `result` only
arrives when the tool completes, so for a live iframe return the live-view URL from a small separate tool
`open_browser` and let the model call `rsvp_event` afterwards.

## 7. Kernel (RSVP in a real browser)

```ts
// src/lib/kernel.ts
import { Kernel } from "@onkernel/sdk";
import { chromium } from "playwright-core";
const kernel = new Kernel();                                  // reads KERNEL_API_KEY

export async function rsvpWithKernel(url: string, name: string, email: string) {
  const session = await kernel.browsers.create({ stealth: true, timeout_seconds: 300 }); // → session_id, cdp_ws_url, browser_live_view_url (snake_case)
  const replay = await kernel.browsers.replays.start(session.session_id);                 // replay survives session deletion
  try {
    const browser = await chromium.connectOverCDP(session.cdp_ws_url);
    try {
      const context = browser.contexts()[0] ?? (await browser.newContext()); // reuse the existing context/page
      const page = context.pages()[0] ?? (await context.newPage());
      await page.goto(url, { waitUntil: "domcontentloaded" });
      if (await page.locator("iframe[src*='captcha'], [data-sitekey]").count()) return { status: "needs_human" };
      // Luma: click Register / One-click, fill name + email, submit (selectors from the 12:30 dry run)
      const png = Buffer.from(await (await kernel.browsers.computer.captureScreenshot(session.session_id)).arrayBuffer());
      return { status: "pending", liveViewUrl: session.browser_live_view_url, screenshot: png };
    } finally { await browser.close(); }                      // local client first…
  } finally {
    await kernel.browsers.replays.stop(replay.replay_id, { id: session.session_id });
    await kernel.browsers.deleteByID(session.session_id);     // …then always delete the session
  }
}
```

- No local Playwright needed with `kernel.browsers.playwright.execute(session_id, { code, timeout_sec: 60 })`:
  `return` inside `code` fills `response.result`; check `response.success`; fresh context per call; never return screenshot bytes from it.
- Replay URL: `(await kernel.browsers.replays.list(session_id)).find(r => r.replay_id === replay.replay_id)?.replay_view_url`.
- Stealth auto-solves CAPTCHAs per the skill; our rule stays: detect → `needs_human`.
- Live view iframe = `browser_live_view_url`. `?readOnly=true` and "5 concurrent browsers free" are from plan.md, **UNVERIFIED**.
- If bundling chokes on `@onkernel/sdk` / `playwright-core`, add them to `serverExternalPackages` (**UNVERIFIED** whether needed).

## 8. AgentMail (agent's own inbox)

```ts
// src/lib/agentmail.ts   (agentmail 0.5.x; path params positional)
import { AgentMailClient } from "agentmail";
const client = new AgentMailClient({ apiKey: process.env.AGENTMAIL_API_KEY });

export async function ensureInbox() {
  const inbox = await client.inboxes.create({ username: "techweek", displayName: "Tech Week Agent", clientId: "techweek-v1" }); // clientId = idempotent
  return inbox.inboxId;                                          // inboxId IS the address
}
export async function newMail(inboxId: string, limit = 20) {
  const page = await client.inboxes.messages.list(inboxId, { limit });   // metadata only: subject, from, labels, timestamps
  const out = [];
  for (const m of page.messages ?? []) {                                 // UNVERIFIED: list field name (`messages`?) — check the SDK type
    const full = await client.inboxes.messages.get(inboxId, m.messageId);
    const body = full.extractedText ?? full.text ?? full.extractedHtml ?? full.html;  // extracted* strips quotes/signatures
    out.push({ id: full.messageId, from: full.from, subject: full.subject, body });
    await client.inboxes.messages.update(inboxId, full.messageId, { addLabels: ["processed"] }); // no read/unread flag; use labels
  }
  return out;
}
```

Polling (`/api/cron/inbox` every 10 s from the UI) is enough for the demo. Webhook, if wanted:

```ts
// once: const wh = await client.webhooks.create({ url: "https://<app>.fly.dev/api/agentmail", eventTypes: ["message.received"] }); // wh.secret = whsec_…
// src/app/api/agentmail/route.ts
import { Webhook } from "svix";
export async function POST(req: Request) {
  const raw = await req.text();                                   // raw body for svix verification (svix-id/-timestamp/-signature headers)
  try { new Webhook(process.env.AGENTMAIL_WEBHOOK_SECRET!).verify(raw, Object.fromEntries(req.headers)); } catch { return new Response(null, { status: 400 }); }
  const event = JSON.parse(raw);   // event.event_type "message.received"; event.message.{inbox_id,message_id,subject,extracted_text}; big bodies omitted → messages.get
  return new Response(null, { status: 204 });                     // answer fast, process async
}
```

Gotchas: no `messages.delete` (delete the thread); `reply()` has no subject; `webhooks.update` cannot change
`url`/`eventTypes` (delete + recreate); SDK retries 429/5xx twice (`maxRetries` in the constructor); `agent.signUp()`
with the same human email **rotates** the key; inbound mail is untrusted. "3 inboxes / 100 mails a day free" is from plan.md, **UNVERIFIED**.

## 9. Exa (long-tail discovery, people)

```ts
import Exa from "exa-js";
const exa = new Exa();                                            // reads EXA_API_KEY
const r = await exa.search("AI video agents meetups San Francisco October 2026", {
  type: "auto",
  contents: { highlights: true },                                 // the recommended request; omit contents = metadata only
  includeDomains: ["lu.ma", "meetup.com", "eventbrite.com"],      // a deliberate product decision: hard allowlist
  startPublishedDate: "2026-09-01",                                // only because the window is a real constraint
  numResults: 25,
});
for (const it of r.results) ({ title: it.title, url: it.url, publishedDate: it.publishedDate, highlights: it.highlights });
```

- Intent goes in the query; pick one of `text`/`highlights`/`summary`; `maxAgeHours` is cache freshness, not recency.
- `category: "people"`: no date filters, `includeDomains` LinkedIn-only, no `excludeDomains`, bad combos → 400. Extraction: `outputSchema` + `systemPrompt`, small schemas.
- Free "$10/month" is from plan.md, **UNVERIFIED**; the skill gives no rate-limit numbers.

## 10. Fly.io

`fly auth login`, then `fly launch` in the repo root. It detects Next.js, prints Organization, Name (directory
name), Region (nearest; pick `sjc`), App Machines (shared-cpu-1x, 1GB), Postgres/Redis/Sentry (none), asks one
question ("tweak these settings?"), writes `fly.toml` + `Dockerfile`, deploys. With `output: "standalone"`
already set, the generated Dockerfile is ~400 MB smaller. Hand-edited Dockerfile tail:

```dockerfile
COPY --from=build /app/.next/standalone /app
COPY --from=build /app/.next/static /app/.next/static
COPY --from=build /app/public /app/public
CMD [ "node", "server.js" ]
```

Next's standalone server needs `HOSTNAME="0.0.0.0"` and listens on `PORT` (default 3000). Minimal `fly.toml`
(fields from the Fly configuration reference; `internal_port` must match Next's port):

```toml
app = "tech-week-agent"
primary_region = "sjc"
[env]
  PORT = "3000"
  HOSTNAME = "0.0.0.0"
[http_service]
  internal_port = 3000
  force_https = true
  auto_stop_machines = "stop"
  auto_start_machines = true
  min_machines_running = 1          # keep one warm for the demo
```

Secrets (runtime, never baked): `fly secrets set DATABASE_URL=... NEON_AI_GATEWAY_BASE_URL=... NEON_AI_GATEWAY_TOKEN=... ANTHROPIC_API_KEY=... EXA_API_KEY=... KERNEL_API_KEY=... AGENTMAIL_API_KEY=...`.
`fly deploy` to redeploy, `fly logs` to tail. `NEXT_PUBLIC_*` is build-time only (`npx @flydotio/dockerfile --arg-build=...`),
and that generator rewrites the Dockerfile any time. Storage is Postgres, so the ephemeral FS is a non-issue.

Sprites (only if cheap): `curl -fsSL https://sprites.dev/install.sh | sh; sprite org auth; sprite create scan-sf
--skip-console; sprite exec -s scan-sf -- bash -lc 'git clone … && node scan.js'`. CI token: `SPRITE_TOKEN=
org-slug/org-id/token-id/token-value`. A `@fly/sprites` SDK is **UNVERIFIED** (skill covers CLI, MCP, REST only).

## 11. Gotchas checklist (from the skills)

- `assistant-ui init` hangs without `-y`; `@assistant-ui/styles` / `react-ui` are retired (styling is in the copied elements).
- Toolkit key ≠ model-visible tool name → card never renders. Keep Mastra tool key, `createTool.id` and toolkit key identical.
- `AuiConfig({ tools: Tools({ toolkit }) })` goes in the provider's `config`, with a stable toolkit.
- No `version: 'v7'` → v5 stream, UI shows nothing useful. No `originalMessages` → duplicated assistant messages.
- Mastra "import outside a module" = CommonJS tsconfig; `Property X does not exist` = stale API, read `node_modules/@mastra/core/dist/docs/`.
- Tool never called: not in `agent.tools`, or input `ZodError`.
- Neon: pooled URL for the app, `DATABASE_URL_UNPOOLED` for drizzle-kit (pooled migrations fail with `prepared statement "s0" already exists`). Compute scales to zero after 5 min idle; keep the demo warm.
- Neon AI Gateway: paid plan, supported region, base URL has no path, `/v1/models` only on `/v1` (`/openai/v1/models` → 404). Neon never sets `OPENAI_*`.
- Kernel: `browser.close()` is not cleanup, `deleteByID` is. Live view dies with the session → keep replay URL + screenshot.
- AgentMail list has no body; classify on `extractedText`.
- Exa: never invent categories; `/findSimilar`, `useAutoprompt`, `numSentences`, `highlightsPerUrl` are deprecated.
- Mastra custom gateways pin `@ai-sdk/openai-compatible-v5`; don't mix with the app's `ai@7` providers. Use the `neon/` router string or `@neon/ai-sdk-provider`.
