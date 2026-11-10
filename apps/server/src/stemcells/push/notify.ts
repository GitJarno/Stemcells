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

const oneLine = (text: string) => text.replace(/\s+/g, " ").trim();

/** Prose as a lock screen shows it: one line, no markup. A name keeps its underscores. */
const plain = (text: string) =>
  oneLine(
    text
      .replace(/\[([^\]\n]+)\]\([^)\s]+\)/g, "$1")
      .replace(/`/g, "")
      .replace(/(?<!\w)[*_]{1,2}(?=\S)|(?<=\S)[*_]{1,2}(?!\w)/g, ""),
  );

/** A push leaves the Mac for the phone, so a key written into a command stays here. */
const KEYS: ReadonlyArray<RegExp> = [
  /\b(\w*(?:key|token|secret|password|passwd)\w*\s*[=:]\s*)\S+/gi,
  /(--?[\w-]*(?:key|token|secret|password)[\w-]*\s+)\S+/gi,
  /\b((?:bearer|basic)\s+)\S+/gi,
];

/** A command, a path or an error: word for word on one line, without the keys in it. */
const literal = (text: string) =>
  KEYS.reduce((kept, key) => kept.replace(key, "$1…"), oneLine(text));

function clipped(text: string, cap = SAID_CAP): string {
  if (text.length <= cap) return text;
  const head = text.slice(0, cap);
  return `${head.slice(0, Math.max(head.lastIndexOf(" "), cap / 2)).trimEnd()}…`;
}

/** A paragraph's own question: its last sentence that asks, else the whole of it. */
function askIn(paragraph: string): string {
  const sentences = paragraph.split(/(?<=[.!?…])\s+/);
  return sentences.findLast((sentence) => /\?["'”’)\]]*$/.test(sentence)) ?? paragraph;
}

const WANTS: Readonly<Partial<Record<NonNullable<Need["request"]>["kind"], string>>> = {
  command: "Wants to run",
  "file-read": "Wants to read",
  "file-change": "Wants to change",
};

/** What the card asks, in the Cell's own words; empty when it has none to show. */
function said(need: Need): string {
  const { request, prose } = need;
  switch (need.kind) {
    case "question": {
      const [first, ...more] = request?.questions ?? [];
      const asked = plain(first?.question ?? "");
      if (asked === "") return "";
      const rest = more.length === 0 ? "" : ` (and ${more.length} more)`;
      return `${clipped(asked, SAID_CAP - rest.length)}${rest}`;
    }
    case "permission": {
      const what = literal(request?.prompt ?? "");
      return request === null || what === ""
        ? ""
        : `${WANTS[request.kind] ?? ASKS.permission}: ${what}`;
    }
    case "plan":
      return need.plan?.title ? `Plan ready: ${plain(need.plan.title)}` : "";
    case "failed":
      return need.failure?.message ? `Stopped with an error: ${literal(need.failure.message)}` : "";
    case "prose":
      if (prose === null || prose.cue === "stopped") return "";
      return prose.cue === "left" ? `Your step: ${plain(prose.text)}` : askIn(plain(prose.text));
    default:
      return "";
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
  return { title: need.title.trim() || "A Cell", body: own === "" ? kind : clipped(own) };
}

/** The cards to push now: each waiting at least `HOLD_MS` and not pushed yet. */
export function due(
  needs: ReadonlyArray<Need>,
  pushed: ReadonlySet<string>,
  now: number,
): ReadonlyArray<Need> {
  return needs.filter((need) => now - Date.parse(need.since) >= HOLD_MS && !pushed.has(need.key));
}
