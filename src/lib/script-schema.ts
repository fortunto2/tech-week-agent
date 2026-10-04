// script.json — the contract between the director and vlog_cut.py (travel-day skill §2).
//   say  [from, to]  sentence indices of that clip (inclusive), speech kept as one track
//   show at/len      cutaway laid over the speech at that second (costs no time)
//   walk at/len      a shot without words that keeps its own sound (costs time)
//   open             cold start: strongest silent frames before the hook line
import { z } from "zod";

export const ShotSchema = z
  .object({
    clip: z.string().regex(/^\d{4}$/, "four-digit clip tag"),
    say: z.tuple([z.number().int().min(0), z.number().int().min(0)]).optional(),
    show: z.number().min(0).optional(),
    walk: z.number().min(0).optional(),
    len: z.number().min(0.5).max(30).optional(),
    note: z.string().max(200).optional(),
  })
  .refine((s) => [s.say, s.show, s.walk].filter((x) => x !== undefined).length === 1, {
    message: "exactly one of say / show / walk",
  });

export const ScriptSchema = z.object({
  _: z.string().describe("one line: what this film is about and its tone"),
  layout: z.object({ hold: z.number().default(4), cutaway: z.number().default(2.8) }).default({ hold: 4, cutaway: 2.8 }),
  open: z
    .object({
      shots: z.array(z.object({ clip: z.string().regex(/^\d{4}$/), at: z.number().min(0), len: z.number().min(0.8).max(3) })).min(3).max(8),
    })
    .optional(),
  shots: z.array(ShotSchema).min(5).max(60),
});

export type Script = z.infer<typeof ScriptSchema>;
export type Shot = z.infer<typeof ShotSchema>;

/** The JSON Schema-ish description the director model gets. Kept in one place so prompt and validator agree. */
export const SCRIPT_FORMAT_DOC = `{
  "_": "one line: what the film is about, tone",
  "layout": {"hold": 4.0, "cutaway": 2.8},
  "open": {"shots": [{"clip": "0477", "at": 15.0, "len": 1.8}, ...]},   // 4-6 cold-open frames, silent, strongest first
  "shots": [
    {"clip": "0504", "say": [21, 22], "note": "HOOK: ..."},            // speech: sentence indices of that clip, inclusive
    {"clip": "0567", "show": 10.0, "len": 2.6, "note": "..."},          // cutaway over the speech at that second
    {"clip": "0412", "walk": 3.0, "len": 12, "note": "..."},            // shot with its own sound (drive, street)
    ...
  ]
}`;
