import type { Script } from "./script-schema";
import { dayIndex } from "./day-text";

/** Pull indices and seconds back inside the footage: an off-by-one from the model must not kill a render. */
export async function clampScriptToDay(dayId: number, script: Script): Promise<Script> {
  const idx = await dayIndex(dayId);
  const shots = script.shots.flatMap((s) => {
    const c = idx.get(s.clip);
    if (!c) return [s];
    // A clip that was never analysed (no duration) cannot be cut; a walk needs the clip's own sound.
    if (!c.durationSecs) return [];
    const out = { ...s };
    if (out.walk !== undefined && c.hasAudio === false) {
      out.show = out.walk;
      delete out.walk;
    }
    if (out.say && c.sentences > 0) {
      const max = c.sentences - 1;
      out.say = [Math.min(out.say[0], max), Math.min(out.say[1], max)];
      if (out.say[0] > out.say[1]) out.say = [out.say[1], out.say[0]];
    }
    const at = out.show ?? out.walk;
    if (at !== undefined && c.durationSecs > 0) {
      const len = out.len ?? 2.6;
      const start = Math.max(0, Math.min(at, c.durationSecs - len));
      if (out.show !== undefined) out.show = start;
      else out.walk = start;
      out.len = Math.min(len, Math.max(0.5, c.durationSecs - start));
    }
    return [out];
  });
  const open = script.open
    ? { shots: script.open.shots.map((o) => { const c = idx.get(o.clip); if (!c || !c.durationSecs) return o; const at = Math.max(0, Math.min(o.at, c.durationSecs - o.len)); return { ...o, at }; }) }
    : undefined;
  return { ...script, shots, open };
}

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
