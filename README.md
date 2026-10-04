# Life2Film Director

A personal agent that turns a day of your own footage into a trailer, and learns your taste from every
correction you make.

Built solo at the **Build Personal Agents Hack** (Neon, Terra Gallery, San Francisco, 4 Oct 2026).
MIT licensed.

## What it does

1. **Knows your footage.** Clips from a DJI pocket camera and phones, with speech (whisper, word
   timings) and picture quality (per-frame scores) analysed on the Mac by
   [life2film/video-analyzer](https://github.com/fortunto2) and stored in **Neon Postgres**:
   `days → clips → sentences / moments`.
2. **Writes the script.** "Собери трейлер недели в долине, 3 минуты" → the director reads the whole
   week as text (2,367 sentences across 163 clips) and your standing rules, and writes `script.json`:
   a cold open, one hook line, three acts, speech kept as one track, cutaways that show what is being
   said, drives with their own sound.
3. **Renders it.** `vlog_cut.py` lays the script out as OpenTimelineIO, the Rust renderer cuts the mp4
   on the Mac (on Fly.io this is a sprite job). The player appears in the chat.
4. **Learns.** "Первые 10 секунд скучные, нужен хук" → the remark becomes a durable rule
   (`rules` table), the script is revised, the opening re-cut. Ten rules were seeded from a month of
   real corrections; every new one is shown as a card.

## Stack (hack sponsors, each doing a real job)

| | |
|---|---|
| Neon Postgres | footage index, scripts, renders, the rules (taste graph), Mastra memory |
| Neon AI Gateway | LLM path when enabled; falls back to Anthropic / OpenAI (`src/lib/llm.ts`) |
| Mastra | the `director` agent and its tools (`src/mastra`) |
| assistant-ui | chat with generative cards: days, script timeline, player, rule learned |
| AgentMail | the agent's own inbox for clips sent from a phone (next) |
| Exa | event / venue facts for captions and descriptions (next) |
| Kernel | posting the reel through a real browser (next) |
| Fly.io | hosting; renders as sprites (next) |

## Run

```bash
pnpm install
cp .env.example .env.local        # Neon DATABASE_URL, an LLM key, FOOTAGE_ROOT, VIDEO_ANALYZER_DIR/BIN
pnpm db:push                      # schema → Neon
pnpm seed:rules                   # the owner's editing rules
pnpm ingest ~/Movies/trip/day1 "Day 1"   # sidecars from video-analyzer → Neon
pnpm dev                          # http://localhost:3000
```

The analysis sidecars (`*.va.stt.json`, `*.MP4.va.otio`) and the renderer come from the author's
open video-analyzer pipeline; the agent, schema, tools and UI were written during the hack.

## Layout

```
src/db/schema.ts            days, clips, sentences, moments, rules, scripts, renders, feedback
src/lib/sidecars.ts         readers for the analysis artefacts
src/lib/day-text.ts         the day as numbered text (what the director reads)
src/lib/script-schema.ts    script.json contract (+ validation against the footage)
src/mastra/agents/director.ts
src/mastra/tools/           list_days · write_script · get_script · render_script · learn_rule · list_rules
src/app/api/chat/route.ts   Mastra → AI SDK v7 stream → assistant-ui
src/app/tool-ui.tsx         generative cards per tool
scripts/ingest.ts           folder → Neon
```
