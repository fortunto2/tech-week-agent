# Plan — Tech Week Agent (Build Personal Agents Hack, Neon, SF, Sun 4.10.2026)

## Context

Rustam is registered for the hack (Terra Gallery, hacking 10:30–16:30, submissions close 16:30). He has
to leave ~14:45 (SFO run) and is back ~16:00, so a **submittable version must exist by 13:00** and the
portal submission should be done before he leaves. He was up all night for Hack-Nation; scope stays small.

The product is the workflow he actually ran for SF Tech Week with scripts: discover events **by lat/long**
(1,300 vs 68 from the place feed), rank for the person, RSVP the free ones, track approvals from the
agent's own inbox, and brief him each morning. The hack turns it into one TypeScript app that uses every
sponsor tool for a real step, which is the obvious way to score with this judge panel (each judge is a
sponsor founder).

Fair-play: before 10:30 only accounts, credits, docs and this plan. All code is written after kickoff.
Reusing his own open event-scanning logic is allowed if the README says so (it will).

## What we found (reusable, no personal data)

- `~/startups/solopreneur/6-crm/bin/luma-scan.py` — Luma lat/long feed
  `api.lu.ma/discover/get-paginated-events?latitude&longitude&pagination_limit=50` + cursor; 403 after
  ~30 fast pages → 0.6 s pause, backoff 10/20/30 s. `ticket_info.{require_approval,is_sold_out,is_free}`
  → one `access` flag.
- `~/startups/solopreneur/6-crm/bin/events-sync.py` — Meetup `gql2` eventSearch (lat/lon/radius 40,
  keyword list), Stanford Localist API, URL-keyed dedupe + `first_seen`, COVERAGE line per run.
- **Official Tech Week MCP**: `https://www.tech-week.com/api/mcp` — verified live 4.10 01:10 (streamable
  HTTP, POST JSON-RPC `tools/list` answers): `search_events` (query, city[] slugs e.g. "sf", date
  YYYY-MM-DD one day only, theme keys), `list_filters`, `get_event`, `get_event_links`. Call
  `list_filters` first; a guessed key silently returns nothing. SF Tech Week is 5–11 Oct 2026.
  Second source next to Luma lat/long, and the natural thing to put behind Executor / Mastra MCPClient.
- Ranking formula already proven in his notes: topic match → drop overlaps with approved events → host
  strength (hosts at 3+ events = people to know) → ≤20 min between venues → 3 picks with one reason each.
- RSVP state is never read from page text: `?tk=` in URL / Invite button / email is the signal.
- `data/seed-events.json` — 2,065 real events (Luma 1,300 / Meetup 476 / Stanford 273 / Indexical 16),
  fields: url, name, start, end, city, venue, platform, access, going, hosts. Demo fallback if Luma 403s.
- Local code to copy as a starting point: `~/startups/active/solo-factory-studio/{drizzle.config.ts,db/}`
  (drizzle + postgres-js, works against a Neon URL), `~/startups/active/life2film/app/api/chat/route.ts`,
  `~/startups/active/openwok/fly.toml` (pattern only).
- Tooling present: node 22, pnpm 10.20, fly 0.4.87 (not logged in), gh logged in as fortunto2.
  **Missing**: Neon, Exa, Kernel, AgentMail keys; neonctl.

## The pitch (2 min, from the laptop)

"I'm in SF 5–11 Oct, I build video AI agents, no crypto." → agent scans by coordinates: **1,300+ events**
(place feed: 68) → **top 10 with a one-line reason each**, conflicts with my calendar flagged →
**one click: it RSVPs 3 free events live** (Kernel live-view embedded in the chat) under its **own
AgentMail address** → confirmation mail lands, status flips to approved → **tomorrow's brief**: 3 events,
walking minutes between venues, 3 people to find and what to ask each.

Wow moments (in priority order, each is a separate tool so it degrades gracefully):
1. **Live RSVP** through Kernel with the browser visible inside the chat.
2. **Own inbox**: the agent has its own email; approvals arrive there, not in his Gmail.
3. **"Who's in the room"**: hosts appearing at 3+ events + Exa lookup → people card (role, why meet, ask).
4. **Day optimizer**: weighted interval scheduling over scored events with travel time between venues
   (haversine × 1.3 at 80 m/min walking, >2 km → Uber 15 min). O(n log n), explainable in one sentence.

## Architecture (one Next.js app, TypeScript, pnpm)

```
tech-week-agent-neon-hack/
  src/app/page.tsx                 assistant-ui Thread + side panel (events table, inbox, brief)
  src/app/api/chat/route.ts        Mastra agent → AI SDK stream → assistant-ui
  src/app/api/cron/inbox/route.ts  poll AgentMail, update application status (also callable as a tool)
  src/mastra/index.ts              Mastra instance (agent + tools + memory)
  src/mastra/agents/concierge.ts   system prompt: profile → plan; never pay, never captcha, never cancel
  src/mastra/tools/
    discover-events.ts             luma.ts + meetup.ts + techweek-mcp.ts + exa-longtail.ts → upsert Neon
    rank-events.ts                 LLM scoring (Neon AI Gateway), structured output {score, reason, tags}
    plan-day.ts                    conflicts + interval scheduling + travel time
    rsvp-event.ts                  Kernel browser session → fill Luma RSVP with the AgentMail address
    check-inbox.ts                 AgentMail list messages → classify approved/waitlist/rejected → Neon
    people-to-meet.ts              host frequency + Exa search → people rows
    morning-brief.ts               composes the brief from Neon
  src/sources/{luma,meetup,techweek-mcp,exa,seed}.ts
  src/db/{schema.ts,index.ts}      drizzle: events, profile, picks, applications, people, mail_log
  src/components/tool-ui/          makeAssistantToolUI cards: EventList, RsvpLive (Kernel iframe), Inbox, Brief, People
  data/seed-events.json            loaded on first run (pnpm db:seed)
  Dockerfile, fly.toml, drizzle.config.ts, README.md (MIT), .env.example
```

Sponsor map (say this in the README and the pitch):

| Tool | Real job in the app |
|---|---|
| Neon Postgres | source of truth: events, picks, applications, people |
| Neon AI Gateway | every LLM call (ranking, classification, brief, chat) |
| Mastra | the agent, its tools, memory, traces |
| assistant-ui | chat + generative UI cards for every tool result |
| Kernel | fills the RSVP form in a real browser, live view in the UI |
| AgentMail | the agent's own address; reads approvals |
| Exa | long-tail event discovery + people lookup |
| Executor | MCP gateway in front of the Tech Week MCP (and our own tools) |
| Fly.io | hosting; the nightly scan as a sprite/long job |
| CodeRabbit | public MIT repo, PRs reviewed (side quest) |

## Schedule (PT) — the clock is the constraint

| When | Deliverable | Done when |
|---|---|---|
| **01:00–09:00** | sleep | — |
| **09:00–10:30** (allowed before kickoff) | accounts + credits: Neon project (DATABASE_URL), Neon AI Gateway key, Exa, Kernel, AgentMail, `fly auth login`, claim links on build-personal-agents.com, portal account; `gh repo create fortunto2/tech-week-agent --public` + MIT | `.env.local` has all keys; repo public |
| 10:30–11:15 | scaffold (`pnpm create next-app`, assistant-ui init, mastra, drizzle), schema, `db:seed` loads 2,065 events into Neon | `select count(*) from events` = 2065 |
| 11:15–12:15 | concierge agent + `rank_events` + chat UI with EventList card | "top 10 with reasons" answers in the UI |
| 12:15–13:00 | `rsvp_event` on one open Luma event via Kernel (live view), AgentMail inbox created, `check_inbox` flips status; `fly launch` deploy | **v1 submittable**: public URL + README + repo |
| 13:00–13:45 | lunch; **record the 2-min backup demo video**; fill the portal form (don't submit yet, or submit and edit if allowed) | video file on disk |
| 13:45–14:40 | `plan_day` + `morning_brief` + people-to-meet; Executor/Tech Week MCP if cheap; UI polish | brief renders for 5.10 |
| **14:40** | **submit in the portal before leaving** | confirmation screenshot |
| 16:00–16:30 | re-check deploy, resubmit if edits allowed, rehearse pitch | — |

Rule: at every slot boundary, commit and push. If a slot overruns, drop the slot's extras, not the next slot.

## Key implementation notes

- **LLM**: AI SDK with `@ai-sdk/openai-compatible` (or `@ai-sdk/openai` with `baseURL`) pointed at Neon
  AI Gateway; model id from the gateway docs (filled in from the SDK research below). Fallback env:
  `ANTHROPIC_API_KEY` from solo-factory-studio if the gateway misbehaves on stage.
- **Discovery is cached**: live Luma scan is a tool, but the demo path reads Neon (seeded). Never let
  a 403 happen on stage. The scan tool prints a COVERAGE line like the scripts do.
- **RSVP**: Luma open events: open `url`, click Register/"One-click", fill name + AgentMail email, submit.
  Approval-required ones become `pending`. Hard stops in code: no `pay`, no `checkout`, no captcha
  (detect and bail with status `needs_human`). Pick 3 open, free, tomorrow-or-later events for the demo
  and dry-run them once at 12:30 so the selectors are known.
- **Inbox**: AgentMail inbox `techweek-<slug>@agentmail.to`; poll on tool call and from
  `/api/cron/inbox`; classify by subject/body with one LLM call: approved / waitlisted / rejected /
  reminder / noise. Each application row keeps `email_message_id`.
- **Ranking**: one LLM call per batch of 40 events (name, hosts, venue, time, access) with the profile →
  `{url, score 0–100, reason ≤ 15 words, topics}` via zod structured output. Pre-filter in SQL: date
  window, city radius, not full, free unless the profile says otherwise.
- **Day plan**: standard weighted interval scheduling with a travel buffer; conflicts with his calendar
  given as a plain list in the profile for the demo (no Google Calendar OAuth today).
- **Executor**: only if its SDK is a 20-minute job; otherwise mention the Tech Week MCP as a source and
  move on. Don't let a gateway eat the brief/people slot.
- **Fly**: Next standalone Dockerfile, `internal_port 3000`, region `sjc`; secrets via `fly secrets set`.
  Long scan as a sprite only if the sprite SDK is trivial; otherwise a route with `maxDuration`.

## Verification

- `pnpm typecheck && pnpm lint` green; `pnpm db:seed` → 2,065 rows.
- Chat: "I'm in SF 5–11 Oct, video AI agents, no crypto" → EventList card with 10 scored rows.
- RSVP: one real open Luma event registered under the AgentMail address; `?tk=` or Invite button seen;
  application row `applied`; the confirmation email appears in the Inbox card within ~1 min.
- Brief: "brief me for tomorrow" → 3 events, minutes between venues, people list.
- Deployed URL loads on the phone over LTE (he will be in an Uber at 16:00).
- Backup demo video exists before 14:40.

## SDK cheat sheet (verified against official docs 4.10.2026; UNVERIFIED marked)

Version drift to respect: **ai@^7** (`createUIMessageStream` + `createUIMessageStreamResponse`, not
`toUIMessageStreamResponse`), **`@assistant-ui/ai-sdk`** (old name `react-ai-sdk`), `defineToolkit`
instead of deprecated `makeAssistantToolUI`.

- **Neon AI Gateway**: OpenAI-compatible proxy per branch, token `nt_live_…` (Console → Connect → AI
  Gateway, or `neon credentials create --scope ai_gateway:invoke`). **Paid plan + prepaid credit required
  → claim the $500 first.** Env `NEON_AI_GATEWAY_BASE_URL`, `NEON_AI_GATEWAY_TOKEN`; `pnpm add
  @neon/ai-sdk-provider ai` → `neon("gpt-5-mini")` / `neon("claude-sonnet-5")`. Mastra model object:
  `{ id: "custom/gpt-5-mini", url: `${BASE}/v1`, apiKey }`. Fallback if gateway activation lags:
  `@ai-sdk/anthropic` with the key from solo-factory-studio.
- **Neon Postgres**: `drizzle-orm/neon-http` + `@neondatabase/serverless`, `drizzle-kit push`. CLI is
  now `neon` (`npm i -g neon; neon login; neon projects create --name techweek --region-id aws-us-east-2;
  neon connection-string`). `neon bootstrap --template mastra` exists; try it first, keep it only if it
  saves time.
- **Mastra**: `@mastra/core @mastra/ai-sdk @mastra/memory @mastra/libsql zod`; `createTool({id,
  description, inputSchema, outputSchema, execute})`; `new Agent({id, name, instructions, model, tools,
  memory})`; `new Mastra({agents, storage: new LibSQLStore({url:'file:./mastra.db'})})`.
  `next.config`: `serverExternalPackages: ["@mastra/*"]`. Route: `mastra.getAgent("concierge").stream(
  messages)` → `toAISdkStream(stream, {from:"agent"})` → `createUIMessageStreamResponse`. Traces for
  judges: `npx mastra dev` Studio on :4111 (`@mastra/observability`, optional).
- **assistant-ui**: `npx assistant-ui@latest init` in the Next app; `useChatRuntime({transport: new
  AssistantChatTransport({api:"/api/chat"})})`; `defineToolkit({ rankEvents: {type:"backend",
  display:"standalone", render: ({result,status}) => <EventList/>} })` keyed by the Mastra tool key.
- **Kernel**: `@onkernel/sdk` + `playwright`; `kernel.browsers.create({stealth:true})` →
  `cdp_ws_url`, `browser_live_view_url` (iframe, `?readOnly=true`); `chromium.connectOverCDP`. Free plan:
  5 concurrent browsers. Captcha: stealth may auto-solve, our rule stays "bail to `needs_human`".
  Delete session after each RSVP (live view dies with it, so screenshot the final state into Neon).
- **AgentMail**: `agentmail` npm, `AGENTMAIL_API_KEY`; `inboxes.create({username, clientId})` →
  `inboxId` **is the address** (`techweek-rustam@agentmail.to`); `inboxes.messages.list(inboxId,
  {limit})` → `subject`, `extractedText`; webhook `message.received` optional, polling every 10 s is
  enough. Free: 3 inboxes, 100 mails/day.
- **Exa**: `exa-js`, `EXA_API_KEY`, free $10/month. `exa.search(q, {type:"fast", numResults:25,
  includeDomains:["lu.ma","meetup.com","eventbrite.com"], startPublishedDate, contents:{text:
  {maxCharacters:2000}}})`. People: `category:"people"` (no date filters there).
- **Executor** (executor.sh, MIT): `npm i -g executor; executor install; executor web` → MCP endpoint
  `http://127.0.0.1:4788/mcp`; add sources (OpenAPI/MCP) with per-tool allow/approve/block. Hosted
  endpoint auth format UNVERIFIED. Plan: register the Tech Week MCP + AgentMail as sources, point
  Mastra `@mastra/mcp` MCPClient at it, and show the approval policy on `rsvp` in the pitch. Timebox
  25 min in the 13:45 slot; skip if it fights.
- **Fly.io**: `fly auth login; fly launch` (Dockerfile + fly.toml), `output:"standalone"`, `fly secrets
  set …`, region sjc. Sprites: `@fly/sprites` `SpritesClient(SPRITES_TOKEN).createSprite("scan-sf")`,
  `s.spawn("bash",["-c","node scan.js"])`; token creation UNVERIFIED → only if claimed in 5 min.
- **Portal** (verified 09:15, logged in as rust.starman via Google): team "Tech Week Agent" created,
  page `build-personal-agents.com/teams/8061ba88-264c-42b0-b70d-28a7a1516971`. **The submission is ONE
  field: DEMO VIDEO URL (≤3 min, judges must be able to open it) + a confirm checkbox.** No repo/
  description fields. So the video IS the submission: record by 14:20, upload unlisted to YouTube,
  paste URL, tick, SAVE SUBMISSION before leaving at 14:45. Credit claim buttons on /stack unlock in
  person on the day (Neon $500 + AI Gateway $500, Mastra $25, Exa $50, Fly $500, Kernel $50,
  AgentMail dev plan; Executor free; CodeRabbit "coming soon"). Sponsor skills install via
  `npx skills add <repo> -s <skills> -y -g -a claude-code`.

## Morning checklist 09:00–10:30 (allowed before kickoff; no code)

1. Portal login → claim links → submission form fields noted.
2. Neon: account, project `techweek` (us-east-2), `DATABASE_URL`; claim $500 AI Gateway + $500 Neon,
   enable gateway, token into `.env.local`. If activation is slow: Anthropic key fallback.
3. Kernel, AgentMail, Exa keys. `fly auth login`. `npm i -g neon executor` (installs only).
4. `gh repo create fortunto2/tech-week-agent --public --license mit` with README stub stating the
   reuse of own event-scanning logic. Push `data/seed-events.json` + docs.
5. Read assistant-ui Mastra full-stack guide once; nothing else.

## Decisions taken (log, undo if wrong)

- Solo team; no Notion write-back today (Neon is the only store; mention Notion as "future view").
- Calendar conflicts come from a profile text field, not Google OAuth.
- Live scan is a tool but the demo reads seeded Neon rows; Luma 403 must never appear on stage.
- Name stays "Tech Week Agent" (repo `tech-week-agent`); rename only if a better one appears for free.
