# Plan v2 — Life2Film Agent: a personal director for your week (pivot 4.10 11:20)

Supersedes the conference-agent plan in `docs/plan.md` for the product; the schedule, accounts and
SDK cheat sheet there still apply.

## Why the pivot

Rooms full of "conference concierge" agents. Nobody else in the room has a working travel-vlog
pipeline (`life2film/video-analyzer`: Rust core, 25+ scripts, `travel-day` skill, 10 published days from
Chicago and California) plus a month of notes on what a human editor still decides. The hack ports
**the editor's reasoning** into a personal agent that learns the owner's taste.

## The product

"Send your day's clips to your agent. It writes the script, cuts the trailer, publishes it, and every
correction you make becomes a rule it keeps."

1. **Ingest** — clips arrive by email to the agent's AgentMail inbox (phone → attachment) or from a
   folder on the Mac. Each clip: time from the container, language, transcript sentences with word
   timings (whisper), per-frame quality scores (life2film-engine WASM / existing `.va.otio`).
   All of it in **Neon**: `clips`, `sentences`, `moments`, `people`, `rules`, `scripts`, `renders`.
2. **Script** — the agent reads the day as text (`day.txt` shape), writes `script.json`
   (`open` cold start, hook line, three acts, `say`/`show`/`walk` shots) under the rules in `rules`
   (seeded from the quotes in `~/Movies/!usa/agent-port-notes.md` §2: hook in the first 10 s, never
   cut a thought mid-sentence, fillers only at sentence ends, drives 10–20 s, show what is talked about).
3. **Render** — `vlog_cut.py --script` → `.otio` → `video-analyzer --render-otio` (or a plain ffmpeg
   trim+concat fallback) on the Mac; on Fly it would run in a sprite. Output mp4 + srt in `renders`.
4. **Review loop** — the owner says "первые 10 секунд скучные, нужен хук с огнём" → the agent stores a
   rule, re-cuts only the opening, re-renders. The rule card shows what it learned. This is the
   "personal" in personal agent.
5. **Publish** — YouTube via the existing `yt_upload.py` (API, OAuth already set up); Instagram/LinkedIn
   via **Kernel** (real browser, live view in chat) as the stretch. **Exa** finds the event/venue/speaker
   facts for captions and the description ("Terra Gallery, Build Personal Agents Hack, judges …").

## Sponsor map

| Tool | Job |
|---|---|
| Neon Postgres | clips, sentences, moments, scripts, renders, people, **rules** (the taste graph) |
| Neon AI Gateway → Anthropic now | script writing, critic pass, rule extraction, captions |
| Mastra | agent `director` + tools, memory in `@mastra/pg` |
| assistant-ui | chat with cards: day index, script timeline, player, rule learned |
| AgentMail | the agent's inbox: clips as attachments, feedback replies |
| Kernel | posting to Instagram/LinkedIn through a real browser (stretch) |
| Exa | facts for captions/descriptions |
| Fly.io | hosting; render as a sprite (stretch; demo renders on the Mac) |
| CodeRabbit | public MIT repo |

## Data on hand (no re-analysis needed for the demo)

`~/Movies/!usa/cali_1week/`: 163 clips (29.09–02.10), 161 `.va.otio`, 157 `.va.stt.json`,
`cali_1week_out/week.txt` (day text), `cali_1week-out/script.json` (a finished script, 1:1 the shape the
agent must produce), `week-valley.mp4` (a finished render for a fallback demo). Today's hackathon clips
go to a new folder `~/Movies/!usa/hack_1004/` and through the same ingest.

Sidecar shapes: `.va.stt.json` = `{sentences:[{text,start,end,words:[…]}], language, duration_secs, model}`;
`.va.otio` = OTIO timeline with `metadata.va` (overall_score, usable_segments, feature_names) and
segments with per-frame scores.

## Tools on the Mac (demo runs from the laptop)

ffmpeg/ffprobe (brew), `whisper` (openai-whisper, uv tool), demucs; `video-analyzer` release binary
building now (`cargo build --release`, needed only for `--render-otio`; fallback = ffmpeg concat).
`life2film-engine` (WASM, in Node) for `score_frame` / `detect_scenes_*` on new clips.

## Build order (v1 by 13:00)

1. Schema + seed: parse `cali_1week` sidecars → Neon (`clips`, `sentences`, `moments`); seed `rules`
   from agent-port-notes §2. CLI script `pnpm ingest <folder>`.
2. Mastra `director` agent, tools: `read_day(folder)`, `write_script(folder, brief)`, `render(script)`,
   `learn_rule(text)`, `list_rules()`. Chat route + assistant-ui page with ScriptTimeline, Player,
   RuleCard tool UIs.
3. Render path: write script.json → `vlog_cut.py --script` → render; show mp4 in chat.
4. Deploy shell to Fly (chat + Neon; render stays local, documented).
5. 13:45+: AgentMail ingest (attachments), Exa captions, Kernel publish, video.

## Demo (2 min)

"Собери трейлер недели в долине" → day index card (163 clips, 4 days, ru/en) → script card (hook, three
acts, 28 shots with notes) → render → player → "первые 10 секунд скучные, нужен хук" → rule card
"Hook: fire/water/neon/face in the first 10 s, never an empty path" → opening re-cut → player.
Then: a clip shot at Terra Gallery an hour ago, sent to the agent's email, appears in today's day index
with its transcript.
