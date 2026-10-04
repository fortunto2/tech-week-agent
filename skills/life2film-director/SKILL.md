---
name: life2film-director
description: Give an agent a personal film director — searchable memory of a person's own footage in Neon (speech + what the camera saw), scripts cut by the owner's standing rules, background renders through the open life2film pipeline, and a learn-a-rule loop. Use when a project needs "find the moment where…", "cut me a 30-second reel from today's clips", "what did we say about…", or a family/vlog archive an agent can edit from. Install with `npx skills add fortunto2/tech-week-agent` or clone the repo.
---

# Life2Film Director

A Mastra agent plus tools that turn a folder (or an uploaded/mailed clip) into memory and cuts.
Everything runs on a Mac with ffmpeg; nothing leaves the machine except LLM calls and Neon.

## Install (5 commands)

```bash
git clone https://github.com/fortunto2/tech-week-agent && cd tech-week-agent && pnpm install
cp .env.example .env.local   # DATABASE_URL (Neon), OPENAI_API_KEY or ANTHROPIC_API_KEY, FOOTAGE_ROOT, VIDEO_ANALYZER_DIR/BIN
pnpm db:push && pnpm seed:rules
pnpm ingest ~/Movies/trip/day1 "Day 1" -5      # existing days with video-analyzer sidecars (tz offset for filename times)
pnpm dev                                        # http://localhost:3000 — or call the tools from your own agent
```

Neon needs `CREATE EXTENSION lakebase_vector CASCADE; CREATE EXTENSION lakebase_text;` once (pgvector + BM25).
For clips with no sidecars: `pnpm ingest-clip clip.MP4` (life2film-engine WASM scores, whisper, caption,
embeddings, and it writes the `.va.otio` / `.va.stt.json` sidecars so the cutter can use the clip).

## The tools (src/mastra/tools), usable from any Mastra agent

| tool | does |
|---|---|
| `list_days` | footage days with clip counts, languages, dates |
| `search_footage(query, dayId?)` | hybrid search over sentences (vector + BM25, RRF) and clip captions; returns `clipTag:idx` refs |
| `write_script(dayId, brief, targetSecs?, feedback?, focus?)` | reads the whole day as text + the rules, returns a validated script.json |
| `render_script(scriptId)` | background render (vlog_cut → OTIO → Rust renderer); poll `render_status` or `/api/renders/<id>` |
| `learn_rule(quote)` | a correction in the owner's words → a durable rule the director obeys |
| `list_rules`, `list_renders`, `describe_film`, `check_inbox` | the rest of the loop |

Import them: `import { director } from "@/mastra/agents/director"` or pick tools individually.

## Rules of the cut (why the output looks edited, not stitched)

Cold open of the strongest silent frames, one hook line, three acts; speech stays whole; cutaways show
what is being said from a clip shot nearby in time; walks keep their own sound and come from silent clips;
a walk or an open frame never comes from a clip without audio; every owner remark becomes a rule.

## What to tell the owner when it fails

- "no clip carries a .va.otio sidecar" → the folder was never analysed: `pnpm ingest-clip` each clip.
- "a vlog cuts on speech, and none of the clips has any" → fewer than 8 recognised words per clip; the
  cutter's hallucination guard. Use `show`/`walk` shots or a longer clip.
- render `failed` with "не вырезался звук" → a clip without an audio track was used for sound; re-run
  `write_script` (the validator now drops those).
