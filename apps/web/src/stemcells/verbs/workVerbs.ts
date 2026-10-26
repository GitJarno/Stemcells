/**
 * The playful word on a turn's working row ("Noodling", then "Noodled for 3m 12s"), chosen once
 * per turn with no model: the person's words pick a topic (`topicOf`), the turn's stable id picks
 * within it (`pick`), so every redraw and the turn's end show the same word, and a chat never
 * says one twice in a row (`chain`). The words are data: `workVerbs.json`.
 */
import { fnv1a } from "../cell/name";
import table from "./workVerbs.json" with { type: "json" };

/** What a prompt is about, as far as one keyword can tell. */
export type Topic =
  | "fix"
  | "design"
  | "test"
  | "research"
  | "build"
  | "plan"
  | "refactor"
  | "remove";

/** How a past form meets its clock: "Noodled for 3m", "Sent it in 3m". */
export type Span = "for" | "in";

/** One word, in both tenses. */
export interface WorkVerb {
  /** "Noodling": the row while the turn runs, and the verb's name. */
  readonly present: string;
  /** "Noodled": written out, never derived (Overthought, Speedran). */
  readonly past: string;
  readonly span: Span;
  /** The topics it fits. */
  readonly topics: ReadonlySet<Topic>;
  /** It also stands in the general pool, unless it only makes sense for its topic. */
  readonly general: boolean;
  /** A favourite comes up twice as often. */
  readonly favourite: boolean;
}

export const TOPICS = table.topics as readonly Topic[];

const isTopic = (word: string): word is Topic => (TOPICS as readonly string[]).includes(word);

/** Every verb, in the table's order. */
export const WORK_VERBS: readonly WorkVerb[] = table.groups.flatMap((group) =>
  group.verbs.map((row) => {
    const [present, past, span, topics, ...flags] = row as [
      string,
      string,
      string,
      string[],
      ...string[],
    ];
    if (span !== "for" && span !== "in") throw new Error(`${present}: span "${span}"`);
    if (!topics.every(isTopic)) throw new Error(`${present}: topics ${topics.join(", ")}`);
    return {
      present,
      past,
      span,
      topics: new Set(topics),
      general: !flags.includes("topic-only"),
      favourite: flags.includes("favourite"),
    };
  }),
);

/** The words that pick a topic (`topicOf`). */
const KEYWORDS: ReadonlyMap<string, Topic> = new Map(
  Object.entries(table.keywords).flatMap(([topic, words]) =>
    isTopic(topic) ? words.map((word) => [word, topic] as const) : [],
  ),
);

/**
 * Only a prompt's opening is read: a pasted log after it says nothing about
 * the ask, and costs a scan.
 */
const SCAN_LIMIT = 400;

const BY_NAME: ReadonlyMap<string, WorkVerb> = new Map(
  WORK_VERBS.map((verb) => [verb.present, verb]),
);

/** The verb named by its present form; null for a word the table doesn't hold. */
export function verbNamed(present: string): WorkVerb | null {
  return BY_NAME.get(present) ?? null;
}

const weightOf = (verb: WorkVerb): number => (verb.favourite ? 2 : 1);

/**
 * The topic of a prompt: the earliest keyword in its opening, whole words
 * only, any case. Null when none matches.
 */
export function topicOf(prompt: string): Topic | null {
  // A character is at most two code units: cut long before splitting it.
  const opening = Array.from(prompt.slice(0, SCAN_LIMIT * 2))
    .slice(0, SCAN_LIMIT)
    .join("")
    .toLowerCase();
  for (const word of opening.split(/[^\p{L}\p{M}]+/u)) {
    const topic = KEYWORDS.get(word);
    if (topic) return topic;
  }
  return null;
}

/** The pool a prompt draws from: its topic's verbs, or the general pool. */
export function poolFor(topic: Topic | null): readonly WorkVerb[] {
  return topic === null
    ? WORK_VERBS.filter((verb) => verb.general)
    : WORK_VERBS.filter((verb) => verb.topics.has(topic));
}

const MASK = (1n << 64n) - 1n;

/** SplitMix64: one seed, one well-spread roll, the same on every device. */
export function mix(seed: bigint): bigint {
  let z = (seed + 0x9e3779b97f4a7c15n) & MASK;
  z = ((z ^ (z >> 30n)) * 0xbf58476d1ce4e5b9n) & MASK;
  z = ((z ^ (z >> 27n)) * 0x94d049bb133111ebn) & MASK;
  return z ^ (z >> 31n);
}

/**
 * The turn's verb: random within its pool by weight, seeded by the turn's
 * stable id, never `avoiding` (the chat's last verb).
 */
export function pick(seed: bigint, prompt: string, avoiding: WorkVerb | null = null): WorkVerb {
  let pool = poolFor(topicOf(prompt));
  if (avoiding !== null && pool.length > 1) pool = pool.filter((verb) => verb !== avoiding);
  const total = pool.reduce((sum, verb) => sum + weightOf(verb), 0);
  let roll = Number(mix(seed) % BigInt(Math.max(1, total)));
  for (const verb of pool) {
    if (roll < weightOf(verb)) return verb;
    roll -= weightOf(verb);
  }
  return pool[0] ?? WORK_VERBS[0]!;
}

/** A turn as the chain reads it: the id it keeps, and the person's words. */
export interface TurnPrompt {
  readonly id: string;
  readonly text: string;
}

/**
 * A chat's verbs, one per turn in order, by the id of the prompt that started it, each avoiding
 * the one before. A turn's seed is its prompt's id: the app makes it before the send and the
 * server keeps it, so the word holds from echo to settle, and two chats asking the same first
 * thing don't open on the same word.
 */
export function chain(prompts: readonly TurnPrompt[]): ReadonlyMap<string, WorkVerb> {
  const verbs = new Map<string, WorkVerb>();
  let last: WorkVerb | null = null;
  for (const prompt of prompts) {
    const verb = pick(fnv1a(prompt.id), prompt.text, last);
    verbs.set(prompt.id, verb);
    last = verb;
  }
  return verbs;
}

/** The working row's word: the turn's verb, or upstream's "Working". */
export function workingWord(verb: WorkVerb | null): string {
  return verb?.present ?? "Working";
}

/**
 * A finished turn's label with its word swapped: upstream's "Worked for
 * 3m 12s" says "Noodled for 3m 12s" or "Sent it in 3m 12s", and its bare
 * "Worked" the past form alone. Any other label stands as upstream wrote
 * it: a stopped turn never jokes ("You stopped after 3m").
 */
export function workedLabel(verb: WorkVerb | null, label: string): string {
  if (verb === null) return label;
  if (label === WORKED) return verb.past;
  if (label.startsWith(WORKED_FOR)) {
    return `${verb.past} ${verb.span} ${label.slice(WORKED_FOR.length)}`;
  }
  return label;
}

/** Upstream's words for a finished turn: "Worked", or "Worked for 3m 12s". */
const WORKED = "Worked";
const WORKED_FOR = "Worked for ";
