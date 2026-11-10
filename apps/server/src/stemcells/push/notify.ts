/**
 * Which cards reach the person's phone, and what each push says
 * (stemcells/tasks/phone-push.md). Only while nobody is at this Mac, and
 * only a card still waiting after `HOLD_MS`: what a screen or Aski's own
 * take answers in the meantime never buzzes anyone. Pure.
 */
import { type Charge, LOW_AT } from "../../../../../stemcells/words/battery.ts";
import type { Need } from "../needs/derive.ts";

/** The charge has run low with no charger: a falling figure at or under `LOW_AT`. */
export const runningOut = (battery: Charge | null): boolean =>
  battery !== null && battery.power === "battery" && battery.percent <= LOW_AT;

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

/** A lock screen shows about this much of a push before it cuts it. */
export const SAID_CAP = 160;

/** Words as a lock screen shows them: one line, no markup. */
const plain = (text: string) =>
  text
    .replace(/\[([^\]\n]+)\]\([^)\s]+\)/g, "$1")
    .replace(/[`*_]{1,2}/g, "")
    .replace(/\s+/g, " ")
    .trim();

function clipped(text: string): string {
  if (text.length <= SAID_CAP) return text;
  const head = text.slice(0, SAID_CAP);
  return `${head.slice(0, Math.max(head.lastIndexOf(" "), SAID_CAP / 2)).trimEnd()}…`;
}

/** A paragraph's own question: its last sentence that asks, else the whole of it. */
function askIn(paragraph: string): string {
  const sentences = paragraph.split(/(?<=[.!?…])\s+/);
  return sentences.findLast((sentence) => /\?["'”’)\]]*$/.test(sentence)) ?? paragraph;
}

/** What the card asks, in the Cell's own words; null when it has none to show. */
function said(need: Need): string | null {
  const { request, prose } = need;
  switch (need.kind) {
    case "question": {
      const [first, ...more] = request?.questions ?? [];
      if (first === undefined) return null;
      return more.length === 0 ? first.question : `${first.question} (and ${more.length} more)`;
    }
    case "permission":
      return request?.prompt ? `Wants to run: ${request.prompt}` : null;
    case "plan":
      return need.plan?.title ? `Plan ready: ${need.plan.title}` : null;
    case "failed":
      return need.failure?.message ? `Stopped with an error: ${need.failure.message}` : null;
    case "prose":
      if (prose === null) return null;
      if (prose.cue === "left") return `Your step: ${prose.text}`;
      return prose.cue === "stopped" ? null : askIn(plain(prose.text));
    default:
      return null;
  }
}

/**
 * A push's words: the Cell's title, and what it asks in its own words, so the lock screen is
 * enough to know what waits. A card with no words of its own says what kind it is.
 */
export function alertWords(need: Need): { readonly title: string; readonly body: string } {
  const own = said(need);
  const kind =
    need.kind === "prose" && need.prose !== null ? CUES[need.prose.cue] : ASKS[need.kind];
  const body = own === null ? "" : plain(own);
  return { title: need.title.trim() || "A Cell", body: body === "" ? kind : clipped(body) };
}

/** The cards to push now: each waiting at least `HOLD_MS` and not pushed yet. */
export function due(
  needs: ReadonlyArray<Need>,
  pushed: ReadonlySet<string>,
  now: number,
): ReadonlyArray<Need> {
  return needs.filter((need) => now - Date.parse(need.since) >= HOLD_MS && !pushed.has(need.key));
}
