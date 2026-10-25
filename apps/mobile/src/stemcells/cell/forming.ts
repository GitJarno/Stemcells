// A Cell forming as its chat starts, as on the Mac (`apps/web/src/stemcells/
// cell/forming.ts`; `stemcells/docs/interaction.md`, The spawn): Aski's
// characters condense over its box, `. : + # @`, one a beat; then its
// outline fills in blocks ░▒▓█; then its own pixels, a crouch and a hop
// onto its line. On the phone a Cell forms when it is first seen within
// moments of its chat starting, wherever it shows first (its card, its
// ledge), and only once: shown again, it stands.

import { BEAT, clockSeconds, formingPart, GLYPHS } from "./kit";

/** How new a chat may be, in ms, for its Cell to form as it first shows: long enough to come back to the home from Aski's chat. */
const FRESH_MS = 60_000;
/** Seconds from a Cell's first sight to its first glyph: a copy of Aski flies to it meanwhile (`home/copies.ts`). */
export const LEAD = 0.6;
/** Seconds between Cells that start together, so their copies leave one by one. */
const STAGGER = 0.15;

/** When each Cell's glyphs start, on `clockSeconds`, by thread id. */
const formings = new Map<string, number>();

/**
 * When the Cell of `threadId`, whose chat began at `createdAt`, starts to
 * form: its glyphs' start on `clockSeconds`, the same each time it is asked;
 * undefined for a Cell that just stands.
 */
export function formingFrom(threadId: string, createdAt: string): number | undefined {
  const known = formings.get(threadId);
  if (known !== undefined) return known;
  if (!(Date.now() - Date.parse(createdAt) < FRESH_MS)) return undefined;
  const now = clockSeconds();
  let latest = now + LEAD - STAGGER;
  for (const [thread, from] of formings) {
    if (from < now - 30) formings.delete(thread);
    else latest = Math.max(latest, from);
  }
  const from = Math.max(now + LEAD, latest + STAGGER);
  formings.set(threadId, from);
  return from;
}

export type FormingStep =
  | { readonly part: "empty" }
  | { readonly part: "glyphs" | "blocks" | "hop"; readonly step: number };

/** Where a Cell whose glyphs start at `from` is in its forming at `seconds`, with a hop `hop` frames long; undefined once it stands. */
export function formingAt(seconds: number, from: number, hop: number): FormingStep | undefined {
  const beats = Math.floor((seconds - from) * BEAT);
  if (beats < 0) return { part: "empty" };
  if (beats < GLYPHS.length) return { part: "glyphs", step: beats };
  const part = formingPart(beats - GLYPHS.length, hop);
  return part?.part === "empty" ? { part: "empty" } : part;
}
