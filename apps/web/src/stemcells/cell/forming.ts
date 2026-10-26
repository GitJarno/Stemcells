// A Cell forming on its line as it starts: the spawn's last beats
// (`stemcells/docs/interaction.md`). The words' stream condenses into glyphs over the Cell's
// box; then the Cell takes over, its outline in blocks ░▒▓█, its own pixels, a crouch and a
// hop. Nothing waits on it: a Cell no call forms just stands.

import { useSyncExternalStore } from "react";

import { reducedMotion } from "../tokens/motion.ts";
import { clockSeconds } from "./blink.ts";
import type { MiniFrame } from "./scene.ts";

/** The hop that lands the Cell on its line once its blocks have formed (`art/moves/form.json`). */
export const HOP = "form/hop";

/** The blocks' steps, one a beat: ░ ▒ ▓ █. */
export const BLOCKS = 4;

/** How far ahead a hand-off may be, in seconds: the box is never left empty longer, whatever a call says. */
const FURTHEST = 3;

/** A forming: its hand-off, and when it was asked for, both on `clockSeconds`. */
export interface Forming {
  readonly at: number;
  readonly asked: number;
}

const formings = new Map<string, Forming>();
const listeners = new Set<() => void>();

/**
 * Forms the Cell of `threadId` at `at`, a `performance.now()` time: before it the Cell's box
 * is the stream's, from it the Cell plays its blocks and hop. Call it as soon as the thread is
 * known: a Cell already standing leaves its box until `at`. A call already played out leaves
 * the Cell standing, and under Reduce Motion nothing forms.
 */
export function formAt(threadId: string, at: number): void {
  if (reducedMotion()) return;
  const asked = clockSeconds();
  const hand = Math.min(asked + (at - performance.now()) / 1000, asked + FURTHEST);
  for (const [thread, forming] of formings)
    if (forming.at < asked - FURTHEST) formings.delete(thread);
  formings.set(threadId, { at: hand, asked });
  for (const listen of listeners) listen();
}

const subscribe = (listen: () => void) => {
  listeners.add(listen);
  return () => listeners.delete(listen);
};

/** The forming asked for the Cell of `threadId`, if any. */
export const formingOf = (threadId: string | undefined): Forming | undefined =>
  threadId === undefined ? undefined : formings.get(threadId);

/** `formingOf`, kept current. */
export function useForming(threadId: string | undefined): Forming | undefined {
  return useSyncExternalStore(subscribe, () => formingOf(threadId));
}

/** Where the Cell of `threadId` stands on its pane's composer line, for the glyphs to condense into; null until it is drawn there. */
export function cellBoxOf(threadId: string): DOMRect | null {
  return drawnCellBoxOf(threadId)?.rect ?? null;
}

/** The Cell of `threadId`'s box on its pane's composer line and where it stands; null until it is drawn there. */
export function drawnCellBoxOf(threadId: string): { element: Element; rect: DOMRect } | null {
  for (const element of document.querySelectorAll(
    `[data-stemcells-cell-box="${CSS.escape(threadId)}"]`,
  )) {
    const rect = element.getBoundingClientRect();
    if (rect.width > 0) return { element, rect };
  }
  return null;
}

/** The order each 2 × 2 of cells lights in as the blocks fill: a Bayer matrix's. */
const BAYER = [
  [0, 2],
  [3, 1],
] as const;

/** The ink most of `rows` is drawn in: the body's own. */
function inkOf(rows: readonly string[]): string {
  const counts = new Map<string, number>();
  for (const row of rows)
    for (const cell of row) if (cell !== ".") counts.set(cell, (counts.get(cell) ?? 0) + 1);
  return [...counts].reduce((most, entry) => (entry[1] > most[1] ? entry : most), [".", 0])[0];
}

const blocked = (rows: readonly string[], step: number): readonly string[] => {
  const ink = inkOf(rows);
  return rows.map((row, y) =>
    [...row].map((cell, x) => (cell !== "." && BAYER[y % 2]![x % 2]! <= step ? ink : ".")).join(""),
  );
};

/** `frame`'s outline in blocks at `step` (0 to 3: ░ ▒ ▓ █), in the body's own ink. */
export function inBlocks(frame: MiniFrame, step: number): MiniFrame {
  return {
    rows: blocked(frame.rows, step),
    detail: blocked(frame.detail, step),
    drawn: { rows: blocked(frame.drawn.rows, step), detail: blocked(frame.drawn.detail, step) },
  };
}

const clear = (rows: readonly string[]) => rows.map((row) => ".".repeat(row.length));

/** `frame` with nothing in it: the box before the hand-off, the stream's. */
export function empty(frame: MiniFrame): MiniFrame {
  return {
    rows: clear(frame.rows),
    detail: clear(frame.detail),
    drawn: { rows: clear(frame.drawn.rows), detail: clear(frame.drawn.detail) },
  };
}

/**
 * Which part of its forming a Cell shows `beats` after the hand-off: the
 * empty box before it, then its blocks, then its hop's frames, then
 * nothing more (undefined), when it plays its mood.
 */
export function formingPart(
  beats: number,
  hop: number,
):
  | { readonly part: "empty" }
  | { readonly part: "blocks" | "hop"; readonly step: number }
  | undefined {
  if (beats < 0) return { part: "empty" };
  if (beats < BLOCKS) return { part: "blocks", step: beats };
  if (beats < BLOCKS + hop) return { part: "hop", step: beats - BLOCKS };
  return undefined;
}
