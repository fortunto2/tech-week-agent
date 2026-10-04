# Tech Week Agent — Build Personal Agents Hack (Neon), SF, Sun 4.10.2026

A personal agent that runs your conference week: finds the events that matter **by location**, applies to
the free ones, tracks approvals in its own inbox, and briefs you on the day. Built from a workflow Rustam
actually ran for SF Tech Week 2026 with scripts and Claude Code; the hack turns it into a product.

## The event (read `docs/hackathon-brief.txt`)

- **Sun 4.10, Terra Gallery, 511 Harrison St, SF.** Rustam is registered (accepted 30.09, rust.starman@gmail.com).
- Schedule (PT): 9:00 doors · 10:00–10:30 sponsor pitches · hacking 10:30–13:00 and 13:45–16:30 ·
  **16:30 submissions close (hackathon portal, build-personal-agents.com)** · 16:30–16:45 judges pick top 6 ·
  **16:45–17:15 top 6 present in person (2 min + 1 min Q&A)** · 17:25 awards · 17:30–19:00 happy hour.
- Solo or team up to 5. Sponsor tools optional. Prizes: 1st $100k Neon AI Gateway + $50k Fly.io credits
  (min $25k + $12.5k per member) + Mastra/Executor/Exa/Kernel credits; 2nd/3rd smaller.
  Side quests: **Best Open Source (CodeRabbit $10k credits)** → make the repo public with a license;
  **Best UI (assistant-ui $750)**.
- Every hacker can claim: $500 Neon AI Gateway, $500 Neon, $500 Fly.io, $50 Kernel, $50 Exa, $25 Mastra,
  AgentMail 1-month dev plan, $1k CodeRabbit per team. Claim links on build-personal-agents.com.
- Judges: Nikita Shamgunov (Databricks/Neon), Scott Johnston (Fly.io CEO), Abhi Aiyer (Mastra CTO),
  Jeff Wang (Exa), Catherine Jue (Kernel CEO), Rhys Sullivan (Executor), Simon Farshid (assistant-ui),
  Haakam Aujla (AgentMail), Erik Thorelli (CodeRabbit), Jakub Krehel (Interfere), James da Costa (a16z).
  Using several sponsor tools well is the obvious way to score with this panel.

## Rustam's day constraints (do not break)

- ~14:45 he drives his daughter to SFO (flight 17:08), returns the Turo Tesla in Redwood City ~15:15, Uber
  back to 511 Harrison ~16:00. **Everything must be submittable remotely before 16:30**, and the demo must
  run from his laptop in 2 minutes. Plan the work so a submittable version exists by ~13:00.
- He was up most of the night (Hack-Nation submission due 06:00). Keep scope small.

## Fair-play rule

Hackathon code is written during the event. Before 10:30 only: this context, the plan, accounts and credits,
architecture notes, and reading our existing scripts. Reusing his own existing open logic (event scanning)
is fine **if the README says so**; the agent, UI and integrations are built today.

## Product (MVP for the demo)

"Tell it where you'll be and what you care about; it does the conference week for you."
1. **Discover by location, not by tag** — the lesson from Tech Week: the Luma "place" feed showed ~68 SF
   events, the lat/long feed ~1,300. Sources: Luma discover API (lat/long), Meetup GraphQL, Exa web search
   for long-tail (university calendars, venue sites). Store in **Neon Postgres**.
2. **Rank for the person** — profile (interests, skip list, own calendar) → LLM scores each event with a
   one-line reason; dedupe; flag conflicts with the calendar.
3. **Apply** — for free events, fill the RSVP form with **Kernel** browser automation (approval-required
   ones become "pending"). Never pay, never solve captchas, never cancel without the user.
4. **Own inbox** — **AgentMail** address used for RSVPs; the agent reads approvals/rejections/reminders and
   updates status in Neon.
5. **Brief** — morning plan: today's approved events, travel time between venues, what to ask whom.
   Chat UI with **assistant-ui**; agent graph in **Mastra**; tools behind **Executor** (MCP gateway);
   long jobs in a **Fly.io** sprite sandbox. LLM through **Neon AI Gateway**.

Demo script (2 min): "I'm in SF 5–11 Oct, I build video AI agents, no crypto." → 1,300 events found →
top 10 with reasons → one click: agent RSVPs 3 free events live via Kernel → AgentMail shows the
confirmation arriving → morning brief for tomorrow.

## Existing logic to read (do not copy personal data)

- `~/startups/solopreneur/6-crm/bin/luma-scan.py` (139 lines): Luma discover by lat/long, cities table,
  pause/retry on 403/429.
- `~/startups/solopreneur/6-crm/bin/events-sync.py` (376 lines): Luma + Meetup GraphQL (`gql2`
  eventSearch with lat/lon/radius) + Stanford Localist API + Indexical HTML; NEW detection; Notion upsert.
- These live in a private repo with personal trip data. Re-implement cleanly here; never copy files from
  `6-crm/trips/` or anything personal.

## Seed data (already collected, public fields only)

- `data/seed-events.json` — **2,065 real Bay Area events from 4.10 onward** (Luma 1,300, Meetup 476,
  Stanford 273, Indexical 16), exported from Rustam's events store: url, name, start/end (ISO), city,
  venue, platform, access (`open|approval|paid|full`), going, hosts. No personal columns.
  Use it to load Neon on startup and as the **demo fallback** if Luma rate-limits (403) live.
- The same events also sit in his Notion database "SF Events — All Platforms" (id in
  `~/startups/solopreneur/6-crm/trips/events/notion.json`, token `~/.config/notion/token`, never print it).
  His Grok Bot reads that Notion DB. Nice demo extra: the agent writes its picks back to a Notion page
  or DB ("Notion as the human-facing view") — but the source of truth for the hack is Neon.
- That Notion DB has a personal «My status» column — never export or show it.

## Stack (suggested — TypeScript to fit the sponsors)

Next.js app (assistant-ui chat) + Mastra agent + Neon Postgres (drizzle) + Kernel + AgentMail + Exa.
Secrets in `.env.local` (gitignored). Public GitHub repo under `fortunto2` with MIT license (CodeRabbit
side quest). Russian for talking to Rustam, English for code, README and pitch.

## Standing rules

No payments, no checkout, no card data, no captchas. Don't cancel/withdraw registrations without his
explicit «отмени». Don't touch Epiphan mail/Slack. Messages in his name: 2–3 human sentences.

## Plan and SDK notes (written 4.10 01:20, before kickoff — no code yet)

- **`docs/plan.md`** is the plan: pitch, architecture, hour-by-hour schedule, verified SDK cheat sheet
  (ai@^7, `@assistant-ui/ai-sdk`, `@neon/ai-sdk-provider`, Kernel/AgentMail/Exa/Executor/Sprites calls),
  morning checklist, decisions log. Read it first after 10:30.
- **Tech Week MCP is live**: `POST https://www.tech-week.com/api/mcp` (streamable HTTP JSON-RPC):
  `search_events` (query, city[] slug "sf", date YYYY-MM-DD one day, theme keys), `list_filters`
  (call first; a guessed key returns nothing), `get_event`, `get_event_links`. SF Tech Week 5–11 Oct.
- **Neon AI Gateway needs a paid plan + prepaid credit** → claim the $500 before enabling it; fallback
  LLM is the Anthropic key in `~/startups/active/solo-factory-studio/.env.local`.
- **Submission = demo video URL (≤3 min) only**, on the team page in the portal (team created 09:15,
  captain rust.starman). Record the video by 14:20, upload unlisted, paste, save before 14:45.
- Nothing sponsor-related exists locally: no Neon/Exa/Kernel/AgentMail keys, `fly` not logged in,
  `neon` CLI not installed. Copyable: `solo-factory-studio/{drizzle.config.ts,db/}`,
  `life2film/app/api/chat/route.ts`.
