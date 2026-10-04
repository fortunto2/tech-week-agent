# Demo video (≤3 min) — Life2Film Director

Record with QuickTime (screen + mic) at ~14:00, upload unlisted to YouTube, paste the URL on the team page,
tick the box, SAVE SUBMISSION before 14:45. App: `pnpm dev -p 3100` → http://localhost:3100.
Pre-rendered fallbacks: `~/Movies/!usa/cali_1week-out/agent-v1/trailer.mp4` (4:00) and the family reel
from thread `demo-family`.

## 0:00 — the problem (15 s, talking head or over the chat)

"I shoot every day of my life on a pocket camera: a month in the US, 160 clips a week. Editing one day takes
me a night. For a month I edited with an AI agent in the terminal and wrote down every correction I gave it.
This is that agent as a product: a personal director that knows my footage and my taste."

## 0:15 — memory (30 s)

Type: **Какие дни со съёмкой у тебя есть?** → days card (163 clips, 156 min, ru/en).
Say: "Everything is in Neon: every sentence anyone said on camera with word timings, every frame's quality
score, and a caption of what the camera saw. Vector + BM25 hybrid search, Lakebase."
Type: **Найди моменты, где дочка говорит про дом** → search card: speech hits + "what the camera saw".

## 0:45 — the director (45 s)

Type: **Собери ролик для бабушки на минуту вокруг этих моментов и отрендери.**
Show the script card (hook, acts, say/show/walk shots), then the render card → press play.
Say: "The script is written against ten standing rules — mine, learned from a month of my own corrections.
The cut is real: OpenTimelineIO through my open-source renderer, on the Mac; on Fly it's a sprite."

## 1:30 — it learns (40 s)

Type: **Первые 10 секунд скучные, нужен хук: огонь, вода, лица.**
Show the **rule learned** card, then the revised script v2 and the new opening.
Say: "A remark becomes a durable rule in Neon. Next film, same taste, no repeat. That's the personal part."

## 2:10 — who it's for + stack (30 s)

"Parents: a family archive you can ask questions and get a reel for grandma. Vloggers: the daily cut without
the editing night. Mastra agent, assistant-ui cards, Neon Postgres + Lakebase Search, LLM through the Neon
AI Gateway path, AgentMail inbox for clips from the phone, Kernel to post, Fly for renders. MIT on GitHub:
fortunto2/tech-week-agent."

## Fallbacks

- Render too slow on stage → say "this one rendered earlier" and open the mp4 from the renders table.
- Model hiccup → re-send the same message; the thread memory keeps the context.
