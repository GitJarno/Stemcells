/**
 * A condition in the person's words (stemcells/tasks/conditions.md): what stopped its Cells,
 * until when, and what happens then. It names no way past a limit. Pure.
 */
import { whenOf } from "./card";
import type { Condition } from "./wire";

export interface ConditionLine {
  readonly key: string;
  /** What stopped them. */
  readonly what: string;
  /** Its reset, as far as the provider said. */
  readonly when: string;
  /** What happens next, in a sentence. */
  readonly then: string;
}

export function conditionLineOf(
  condition: Condition,
  now: number,
  locale?: string,
  timeZone?: string,
): ConditionLine {
  const one = condition.cells.length === 1;
  const reset = condition.resetAt === null ? Number.NaN : Date.parse(condition.resetAt);
  const base = { key: condition.key, what: "Usage limit" };
  if (condition.resetAt === null || Number.isNaN(reset)) {
    return {
      ...base,
      when: "no reset stated",
      then: one ? "Nothing carries it on." : "Nothing carries them on.",
    };
  }
  const at = whenOf(condition.resetAt, now, locale, timeZone);
  const past = reset <= now;
  if (condition.waits === "reset") {
    const left = condition.cells.filter((cell) => !cell.carriesOn).length;
    const goes = one ? "It carries on by itself." : "They carry on by themselves.";
    return {
      ...base,
      when: past ? `reset ${at}` : `resets ${at}`,
      then: left === 0 ? goes : `${goes.slice(0, -1)}, except ${left} you turned off.`,
    };
  }
  return {
    ...base,
    when: past ? `reset ${at}` : `resets ${at}`,
    then: past
      ? one
        ? "It is still stopped."
        : "They are still stopped."
      : one
        ? "Nothing carries it on."
        : "Nothing carries them on.",
  };
}
