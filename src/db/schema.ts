// Life2Film Agent — Neon Postgres schema (drizzle).
// Domain: Day → Clip → Sentence (speech) / Moment (picture) ; Script → Render ; Rule (the owner's taste).
import {
  boolean,
  doublePrecision,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const days = pgTable("days", {
  id: serial("id").primaryKey(),
  folder: text("folder").notNull().unique(), // absolute path of the footage folder on the Mac
  title: text("title").notNull(),
  shotFrom: timestamp("shot_from", { withTimezone: true }),
  shotTo: timestamp("shot_to", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const clips = pgTable(
  "clips",
  {
    id: serial("id").primaryKey(),
    dayId: integer("day_id")
      .notNull()
      .references(() => days.id, { onDelete: "cascade" }),
    tag: text("tag").notNull(), // the four-digit camera number: DJI_…_0505_D → "0505"
    file: text("file").notNull(), // basename
    shotAt: timestamp("shot_at", { withTimezone: true }), // from the container, never from the filename
    durationSecs: doublePrecision("duration_secs"),
    language: text("language"), // whisper's per-clip language, or null when silent
    overallScore: doublePrecision("overall_score"),
    isVertical: boolean("is_vertical").default(false),
    resolution: text("resolution"),
    source: text("source").default("folder"), // folder | agentmail
  },
  (t) => [uniqueIndex("clips_day_file").on(t.dayId, t.file)],
);

export const sentences = pgTable("sentences", {
  id: serial("id").primaryKey(),
  clipId: integer("clip_id")
    .notNull()
    .references(() => clips.id, { onDelete: "cascade" }),
  idx: integer("idx").notNull(), // sentence number inside the clip, the one script.json's `say` refers to
  text: text("text").notNull(),
  startSecs: doublePrecision("start_secs").notNull(),
  endSecs: doublePrecision("end_secs").notNull(),
  words: jsonb("words").$type<{ text: string; start: number; end: number; confidence?: number }[]>(),
});

export const moments = pgTable("moments", {
  id: serial("id").primaryKey(),
  clipId: integer("clip_id")
    .notNull()
    .references(() => clips.id, { onDelete: "cascade" }),
  startSecs: doublePrecision("start_secs").notNull(),
  endSecs: doublePrecision("end_secs").notNull(),
  score: doublePrecision("score").notNull(),
  isGarbage: boolean("is_garbage").default(false),
  bestFrameTs: doublePrecision("best_frame_ts"),
  features: jsonb("features").$type<Record<string, number>>(),
});

// The taste graph: every correction the owner ever made, as a durable rule the director must obey.
export const rules = pgTable("rules", {
  id: serial("id").primaryKey(),
  text: text("text").notNull(), // the rule, in the owner's words where possible
  category: text("category").notNull(), // hook | speech | cutaway | pacing | cover | copy | music
  source: text("source"), // the original quote or "seed"
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const scripts = pgTable("scripts", {
  id: serial("id").primaryKey(),
  dayId: integer("day_id")
    .notNull()
    .references(() => days.id, { onDelete: "cascade" }),
  version: integer("version").notNull().default(1),
  brief: text("brief"), // what the owner asked for
  body: jsonb("body").notNull(), // script.json: { _, open, layout, shots: [{clip, say|show|walk, len, note}] }
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const renders = pgTable("renders", {
  id: serial("id").primaryKey(),
  scriptId: integer("script_id")
    .notNull()
    .references(() => scripts.id, { onDelete: "cascade" }),
  kind: text("kind").notNull().default("trailer"), // trailer | episode | reel
  status: text("status").notNull().default("queued"), // queued | rendering | done | failed
  path: text("path"), // local mp4 path (served by /api/media)
  durationSecs: doublePrecision("duration_secs"),
  log: text("log"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const feedback = pgTable("feedback", {
  id: serial("id").primaryKey(),
  scriptId: integer("script_id").references(() => scripts.id, { onDelete: "set null" }),
  text: text("text").notNull(),
  ruleId: integer("rule_id").references(() => rules.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type Day = typeof days.$inferSelect;
export type Clip = typeof clips.$inferSelect;
export type Sentence = typeof sentences.$inferSelect;
export type Moment = typeof moments.$inferSelect;
export type Rule = typeof rules.$inferSelect;
export type Script = typeof scripts.$inferSelect;
export type Render = typeof renders.$inferSelect;
