// How a name is compared (stemcells/tasks/aski-orchestrator.md, principle 3): to act, a name
// must be said as it is written, case, dashes and humps aside. Anything else was only heard
// near, and waits for the person.

import { nearness } from "../recall/byEar.ts";

/**
 * A name's words: camel humps split, a [bracket note] removed, a possessive shed, dashes and
 * underscores as spaces. "PriceDrop" and "price-drop's" are both "price drop".
 */
export function nameWords(name: string): string[] {
  return name
    .replace(/\[[^\]]*\]|\([^)]*\)/gu, " ")
    .replace(/([a-z])([A-Z])/gu, "$1 $2")
    .toLowerCase()
    .replace(/['’]s\b/gu, "")
    .split(/[^\p{L}\p{N}.]+/u)
    .map((word) => word.replace(/^\.+|\.+$/gu, ""))
    .filter((word) => word.length > 0);
}

/** A name as one comparable string: "Harbor Design" and "harbor-design" are "harbor design". */
export const said = (name: string): string => nameWords(name).join(" ");

/** Whether `heard` says `name`, or one of its other names, exactly. */
export function saysExactly(heard: string, name: string, aliases: readonly string[] = []): boolean {
  const words = said(heard);
  if (words.length === 0) return false;
  const joined = words.replaceAll(" ", "");
  return [name, ...aliases].some((one) => {
    const other = said(one);
    return other === words || other.replaceAll(" ", "") === joined;
  });
}

/** Text with its whitespace as single spaces and its case folded, for finding a quote in it. */
export const flat = (text: string): string => text.replace(/\s+/gu, " ").trim().toLowerCase();

/** Where `quote` stands in `text`, case and whitespace aside, as whole words; -1 when it doesn't. */
export function findQuote(text: string, quote: string): number {
  const needle = flat(quote);
  if (needle.length === 0) return -1;
  const hay = text.toLowerCase();
  // Each run of whitespace in the quote matches any run in the text.
  const pattern = needle
    .split(" ")
    .map((word) => word.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"))
    .join("\\s+");
  const match = new RegExp(`(?<![\\p{L}\\p{N}])${pattern}(?![\\p{L}\\p{N}])`, "u").exec(hay);
  return match ? match.index : -1;
}

/** Effort levels from least to most, across providers. */
const EFFORT_ORDER = [
  "none",
  "minimal",
  "low",
  "medium",
  "high",
  "xhigh",
  "max",
  "ultra",
  "ultracode",
];

/** What people say for a level: "extra high" is xhigh, "maximum" is max. */
const EFFORT_SAID: Readonly<Record<string, string>> = {
  "extra high": "xhigh",
  "x high": "xhigh",
  "very high": "xhigh",
  maximum: "max",
  highest: "max",
  lowest: "low",
  mid: "medium",
  normal: "medium",
};

/**
 * The model's own level nearest to the one asked for, rounding up on a tie: "max" on a model
 * that tops out at xhigh is xhigh. Null when the model has no levels or the word is no level.
 */
export function clampEffort(level: string, efforts: readonly string[]): string | null {
  const word = said(level);
  const asked = EFFORT_SAID[word] ?? word.replaceAll(" ", "");
  if (efforts.includes(asked)) return asked;
  const want = EFFORT_ORDER.indexOf(asked);
  if (want < 0) return null;
  let best: string | null = null;
  let bestDistance = Infinity;
  for (const effort of efforts) {
    const rank = EFFORT_ORDER.indexOf(effort);
    if (rank < 0) continue;
    const distance = Math.abs(rank - want);
    if (
      distance < bestDistance ||
      (distance === bestDistance && best !== null && rank > EFFORT_ORDER.indexOf(best))
    ) {
      best = effort;
      bestDistance = distance;
    }
  }
  return best;
}

/** The least nearness at which a heard word is learned as a name's other name. */
const LEARNABLE = 0.6;

/**
 * Whether `heard` could be one of `names` misheard ("harbour" for Harbor). Only such a word is
 * learned: one that merely stood in the message ("fix") would send every later message there.
 */
export const mishearingOf = (heard: string, names: readonly string[]): boolean =>
  names.some((name) => nearness(heard, name) >= LEARNABLE);

/** What a model is called aloud: its name, or its family alone ("Fable" for Fable 5.1). */
export const modelSaid = (name: string): string[] => [name, nameWords(name)[0] ?? name];
