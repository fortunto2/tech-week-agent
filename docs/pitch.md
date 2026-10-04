# Pitch — Life2Film Director (2 min + 1 min Q&A)

No deck: the app on screen, the demo video (https://youtu.be/q82Q4302cio) as a fallback.

**Who.** People who shoot a lot and edit nothing: parents (a family archive you can ask questions, and a
reel for grandma) and vloggers (the daily cut without the editing night). The author: a month in the US,
160 clips a week, one night of editing per day.

**What.** A personal director. Three actions: upload clips → ask → get the cut. It remembers everything
you said and filmed, cuts by your rules, and learns from every correction.

**Demo.** Upload two clips → live analysis (engine frame scores, whisper lines, caption, embeddings →
Neon) → "cut me a 30-second reel from what I uploaded" → script with a hook and three acts → background
render → player. Then: "the first ten seconds are boring, I need a hook" → rule learned, version 2.

**Spoken text (≈120 words).**
I shoot every day on a pocket camera. Editing one day took me a night. For a month I edited with an AI
agent and wrote down every correction. This is that agent as a product. Drop a clip: the life2film engine
scores every frame, whisper transcribes, a vision model captions, everything lands in Neon with vector and
BM25 search. Ask for a 30-second reel: the director writes the script by my ten standing rules, renders
it, and the player appears. Say "the opening is boring, I need a hook" — that becomes a rule it keeps
forever. For parents it's a family archive you can ask questions. For vloggers it's the daily cut without
the editing night. Open source, MIT.

**Sponsors, by role.** Neon Postgres + Lakebase Search: all memory (677 clips, 5,518 sentences, 385
captions), hybrid vector+BM25 search, rules, agent memory. Mastra: the director agent, 10 tools.
assistant-ui: chat with generative cards. AgentMail: the agent's own inbox, clips from the phone become
footage. Exa: facts for descriptions and chapters. Neon AI Gateway: wired, needs the paid plan (OpenAI
today). Fly: no card, renders are local. Kernel: not reached. Say it plainly.

**Our algorithms.** life2film-engine (Rust → WASM, 31 measurements per frame, shot boundaries) runs in
Node; vlog_cut (speech as one track, cutaways in silent windows, drives from silent clips); the Rust OTIO
renderer.

**Before vs during the hack.** Before: the analysis engine, the renderer, the editing scripts, a month of
notes with the rules (all open source). Today: the agent, the Neon schema and search, upload with live
analysis, sidecars from our own analysis, background render, the learn-a-rule loop, inbox, UI, CI, video.

**"Why not another AI editor?"** It does not offer a template; it knows your clips and your taste. Every
remark becomes a rule, and the second cut is better than the first.
