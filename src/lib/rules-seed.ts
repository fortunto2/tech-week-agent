// The owner's editing taste, as rules. Each one was learned from a bad cut and a correction
// (quotes from the travel-day notes, Sep–Oct 2026). The director must obey them all; new corrections
// become new rows in `rules` through the learn_rule tool.
export const RULES_SEED: { text: string; category: string; source: string }[] = [
  {
    text: "Open with a hook in the first 10 seconds: fire, water, neon, night, a face with an expression, something moving toward the camera. Never an empty path through trees, however sharp.",
    category: "hook",
    source: "«в первых 10 секундах кадры ты скучные поставил… обязательно хук! красивые, на корове, огонь еще чтото» (23.09.2026)",
  },
  {
    text: "Keep a thought whole: a `say` span ends on the last meaningful word of the sentence, never mid-phrase. Emotional lines (the bridge, the first look) stay complete even if long.",
    category: "speech",
    source: "«ты обрезал чет мои мысли фразы, особенно на мосту были эмоции»; «не прерывать на полуслове»",
  },
  {
    text: "Filler words («вот», «ну», «как бы», «в общем», «короче», «типа») are cut at the ends of a line; in the middle only when the cut lands in a silent gap and the meaning does not change.",
    category: "speech",
    source: "«фразы паразиты убирать на концах, в середине если не сильно менять смысл» (28.09.2026)",
  },
  {
    text: "Driving and walking shots run 10–20 seconds with their own sound; cut them from silent clips only.",
    category: "pacing",
    source: "«куски проезда я думаю длиннее 10-20 сек»",
  },
  {
    text: "Show what is being talked about, from the same place and time (a clip within 8 minutes of the line). A long shot that is off-topic is replaced by the city.",
    category: "cutaway",
    source: "«этот кадр длинный не в тему… лучше город поставь»",
  },
  {
    text: "More bright frames overall; where the owner is driving, cut faster and more dynamically.",
    category: "pacing",
    source: "«вообще побольше ярких кадров и где еду там динамичнее нарезать»",
  },
  {
    text: "Three acts with at least three scenes each; no single place takes more than a third of the film, keep the emotions.",
    category: "pacing",
    source: "travel-day skill, learned on the Apple Store day",
  },
  {
    text: "Cover frame: a straight, sharp, flattering face; the title is about the whole day, not one stop, and titles are in English.",
    category: "cover",
    source: "«обложка рожу у меня кривая… и можно тексты названия все на англ?»; «это в целом не про гараж видео»",
  },
  {
    text: "Random music or radio in a scene is removed from the audio (stems + own score); the picture is never cut for it.",
    category: "music",
    source: "«музыку случайное или радио… удалять, но видео не трогать»",
  },
  {
    text: "Never a cutaway while lips are moving on screen; cutaways go into silent windows only.",
    category: "cutaway",
    source: "travel-day skill",
  },
];
