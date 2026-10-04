# Technical review — 4.10 14:50 (what works, what is thin, what to simplify)

## Works end to end (measured today)

| Flow | Measured |
|---|---|
| Ingest a day from sidecars → Neon | 163 clips / 2,367 sentences / 3,084 moments in ~4 min; 9 days, 648 clips total |
| Upload a new clip → live analysis → Neon | 26 s clip: 52 frames scored in 3.6 s (WASM), whisper small ~20 s, caption ~4 s, embeddings ~2 s |
| Hybrid search (Lakebase vector + BM25, RRF) | 0.5–1.2 s per query; picture search over 159 captions |
| write_script (gpt-5.5, whole week in context) | 97 s; validated and clamped against the footage |
| render (vlog_cut → OTIO → Rust renderer) | 2:00–4:00 trailer in 150–170 s |
| learn_rule → revise → render | works; rule 11 learned from one Russian remark |
| Chat UI with generative cards | days, search, script, renders, rules, inbox, description |

## Thin or risky

1. ~~Render is a tool call inside the chat request~~ **Fixed 15:30**: `render_script` returns at once, the job
   runs in the background (`src/lib/render.ts`), the card polls `/api/renders/<id>` and shows the renderer's
   own progress lines, then the player with a poster.
2. **Only one LLM path tested: OpenAI direct.** Neon AI Gateway needs the paid plan (claim pending); Anthropic
   key is absent on this machine. The switch is one env var, but it is untested.
3. **Scene detection at 2 fps** gives one shot for most 20–30 s clips; a 4 s window fallback keeps the shot
   table useful. 10 fps sampling would locate cuts to the frame (engine doc says so) at ~5× the decode cost.
4. **Whisper `small` on CPU**: ~1× realtime, English/Russian fine, names wrong (known; glossary exists in the
   old pipeline, not wired here).
5. **AgentMail inbox path is untested with a real mail** (no clip was sent during the hack). Code follows the
   SDK skill exactly; the label step is best-effort.
6. **No Fly deploy**: account needs a card; the renderer and whisper are Mac-local anyway. The honest story:
   chat + Neon anywhere, media jobs on the Mac (or a sprite with ffmpeg + the Rust binary).
7. **Evicted iCloud days**: sidecars ingest fine, captions/thumbnails skip them (never download by accident).
8. **Mastra memory thread is fixed** (`owner-main` unless `threadId` is sent). Fine for one owner.

9. ~~Uploaded clips could not be cut~~ **Fixed 15:40**: `vlog_cut.py` needs `.va.otio` / `.va.stt.json` beside
   each clip; ingest now writes both from our own analysis (`src/lib/sidecars-write.ts`). Measured: two
   uploaded clips → 35 s reel rendered in 24 s. Clips with < 8 recognised words are skipped by the cutter
   (its hallucination guard), which is right.

## Simplify, and where the wow is

- **One action demo**: drop a clip → watch frames being scored, lines appear, caption land → ask "what did I
  say?" → "cut me 30 seconds for grandma". That is the product. The upload panel could be the whole first
  screen; the chat is the second.
- **Photo library instead of files**: Apple Photos via `photos-bridge` (already in video-analyzer/swift)
  would let the owner pick a day instead of files. Not today.
- **Show the taste**: the rules card is the differentiator; show it before the first cut, not after.
- **Cut the long wait**: pre-render on ingest for "today" in the background, so the owner's first ask returns
  a film instantly.
