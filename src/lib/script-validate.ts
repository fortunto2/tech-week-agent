import type { Script } from "./script-schema";
import { dayIndex } from "./day-text";

/** Checks a script against what the day actually contains. Returns human-readable problems; empty = ok. */
export async function validateScriptAgainstDay(dayId: number, script: Script): Promise<string[]> {
  const idx = await dayIndex(dayId);
  const problems: string[] = [];
  const check = (tag: string, where: string) => {
    const c = idx.get(tag);
    if (!c) problems.push(`${where}: clip ${tag} is not in this day`);
    return c;
  };
  for (const [i, s] of script.shots.entries()) {
    const c = check(s.clip, `shots[${i}]`);
    if (!c) continue;
    if (s.say) {
      const [a, b] = s.say;
      if (a > b) problems.push(`shots[${i}]: say [${a},${b}] is reversed`);
      if (b >= c.sentences) problems.push(`shots[${i}]: clip ${s.clip} has ${c.sentences} sentences, say asks for ${b}`);
    }
    const at = s.show ?? s.walk;
    if (at !== undefined && c.durationSecs && at + (s.len ?? 2.6) > c.durationSecs + 0.5) {
      problems.push(`shots[${i}]: clip ${s.clip} is ${c.durationSecs.toFixed(0)}s, shot at ${at}s+${s.len ?? 2.6}s runs past the end`);
    }
  }
  for (const [i, o] of (script.open?.shots ?? []).entries()) {
    const c = check(o.clip, `open[${i}]`);
    if (c && c.durationSecs && o.at + o.len > c.durationSecs + 0.5) problems.push(`open[${i}]: runs past the end of ${o.clip}`);
  }
  if (!script.shots.some((s) => s.say)) problems.push("no speech at all: a trailer needs at least a hook line");
  return problems;
}
