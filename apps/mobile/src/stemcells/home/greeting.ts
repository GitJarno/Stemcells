// What Aski says over the home: a line from its own bank (the web's
// `aski/persona.md`, word for word, which `greeting.test.ts` holds it to),
// true to the moment. Anything waiting on you gets plain words and no joke;
// otherwise a tap rolls another line of the same moment.

import type { TabCounts } from "./tabs";

const GREETINGS = [
  "Hey there.",
  "Let me be the bridge.",
  "Tell me. I'll carry it across.",
  "Your idea, this way.",
];

/** Cells at work and nothing for you. `N` is written out, as the persona has it. */
const AT_WORK = [
  "N Cells flying. Your hands are free.",
  "The Cells have it.",
  "Quiet means it's working.",
  "I'll call you if anything needs you.",
  "Nothing for you. That's the dream.",
];
const ALL_AT_WORK = "All hands busy. Except yours.";

/** Every Cell is done and nothing waits. */
const ALL_DONE = [
  "That's everything. Nicely done.",
  "All done. Go outside. Gently.",
  "Let's do something memorable.",
];

/** Nothing running at all. */
const QUIET = [
  "Quiet in here. What shall we make?",
  "Blank page. My favourite.",
  "Nothing running. All potential.",
  "Every Cell starts as a sentence.",
  "Say it. I'll grow it.",
];

/** Every line the bank lends the home, for the test that holds them to it. */
export const BANK: readonly string[] = [
  ...GREETINGS,
  ...AT_WORK,
  ALL_AT_WORK,
  ...ALL_DONE,
  ...QUIET,
];

const WORDS = ["No", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten"];

/** A count as the persona writes one: in words up to ten. */
const spelled = (n: number): string => WORDS[n] ?? String(n);

/** The lines true of the home with `counts`, past its greeting. */
export function linesFor(counts: TabCounts): readonly string[] {
  if (counts.input > 0)
    return [
      counts.input === 1 ? "One Cell needs you." : `${spelled(counts.input)} Cells need you.`,
    ];
  if (counts.working > 0)
    return [
      ...AT_WORK.map((line) =>
        !line.startsWith("N ")
          ? line
          : counts.working === 1
            ? line.replace("N Cells", "One Cell")
            : line.replace("N", spelled(counts.working)),
      ),
      ...(counts.working > 1 ? [ALL_AT_WORK] : []),
    ];
  return counts.active > 0 ? ALL_DONE : QUIET;
}

/**
 * The line after `rolls` taps: a greeting, then round the moment's lines,
 * `seed` picking where each starts. What waits on you comes before any
 * greeting.
 */
export function greetingAt(counts: TabCounts, rolls: number, seed: number): string {
  const lines = linesFor(counts);
  if (counts.input > 0) return lines[0]!;
  if (rolls === 0) return GREETINGS[seed % GREETINGS.length]!;
  return lines[(seed + rolls - 1) % lines.length]!;
}
