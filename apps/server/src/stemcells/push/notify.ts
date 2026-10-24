/**
 * Which cards reach the person's phone, and what each push says
 * (stemcells/tasks/phone-push.md). Only while nobody is at this Mac, and
 * only a card still waiting after `HOLD_MS`: what a screen or Aski's own
 * take answers in the meantime never buzzes anyone. Pure.
 */
import type { Need } from "../needs/derive.ts";

/** A card waits this long before the phone hears of it: past Aski's 30 s take, and a quick answer elsewhere. */
export const HOLD_MS = 2 * 60_000;

const ASKS: Readonly<Record<Need["kind"], string>> = {
  permission: "Asks for permission",
  question: "Has a question",
  "sign-in": "Needs you to sign in again",
  input: "Asks for input",
  limit: "Hit its usage limit",
  failed: "Stopped with an error",
  plan: "Has a plan ready",
  prose: "Has a question",
  stuck: "Has gone quiet",
};

const CUES: Readonly<Record<NonNullable<Need["prose"]>["cue"], string>> = {
  question: "Has a question",
  offer: "Offers to go on",
  stopped: "Stopped short of done",
  left: "Waits on you",
};

/** A push's words: the Cell's title, and what it waits on. */
export function alertWords(need: Need): { readonly title: string; readonly body: string } {
  const body =
    need.kind === "prose" && need.prose !== null ? CUES[need.prose.cue] : ASKS[need.kind];
  return { title: need.title.trim() || "A Cell", body };
}

/** The cards to push now: each waiting at least `HOLD_MS` and not pushed yet. */
export function due(
  needs: ReadonlyArray<Need>,
  pushed: ReadonlySet<string>,
  now: number,
): ReadonlyArray<Need> {
  return needs.filter((need) => now - Date.parse(need.since) >= HOLD_MS && !pushed.has(need.key));
}
