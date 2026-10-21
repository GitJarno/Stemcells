// Aski's half of a spawn, for a composer that starts several Cells from one
// message. The composer says when the message goes (`spawnStart`), when its
// Cells are known (`spawnPlanned`) and when they have started (`spawnDone`);
// Aski pours the message in and circles it while the Cells are planned, then
// buds one small cloud per Cell. `AskiSpawn` plays it at the rect the
// composer gives. The calls are safe in any order: a repeat, or a call with
// no spawn to belong to, does nothing.

import { theBud } from "./scenes/the-bud.ts";
import { POUR, POURED } from "./scenes/the-pour.ts";
import { taskWord } from "./moments/many.ts";

/** Where the act plays, in viewport CSS pixels (`getBoundingClientRect`). */
export interface SpawnRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** A Cell the message starts, by its title. */
export interface SpawnCell {
  readonly title: string;
}

export interface Spawn {
  readonly id: number;
  readonly rect: SpawnRect;
  /** The message, poured in. */
  readonly text: string;
  readonly cells: readonly SpawnCell[];
  /** Unix milliseconds; null until it happens. */
  readonly startedAt: number;
  readonly plannedAt: number | null;
  readonly doneAt: number | null;
}

/** The most Cells budded: the bud's own limit. More start all the same. */
export const BUDDED = 4;
/** Milliseconds an act waits for the composer's next word before it goes on its own. */
export const SPAWN_WAITS = { plan: (POURED + POUR.hold) * 1000, start: 10_000 } as const;

let current: Spawn | null = null;
const listeners = new Set<() => void>();

function set(next: Spawn | null): void {
  current = next;
  for (const listener of listeners) listener();
}

/** The message `text` goes to start `cells` (none yet, when a plan will pick them). One spawn plays at a time. */
export function spawnStart(rect: SpawnRect, cells: readonly SpawnCell[], text = ""): void {
  if (current !== null && current.doneAt === null) return;
  set({
    id: (current?.id ?? 0) + 1,
    rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
    text,
    cells,
    startedAt: Date.now(),
    plannedAt: null,
    doneAt: null,
  });
}

/** The Cells are known: `cells`, when the plan picked them, or those it started with. */
export function spawnPlanned(cells?: readonly SpawnCell[]): void {
  if (current === null || current.plannedAt !== null || current.doneAt !== null) return;
  set({ ...current, cells: cells ?? current.cells, plannedAt: Date.now() });
}

/** The Cells have started, or the spawn is off. */
export function spawnDone(): void {
  if (current === null || current.doneAt !== null) return;
  set({ ...current, doneAt: Date.now() });
}

/** The theater is through with spawn `id`. */
export function spawnGone(id: number): void {
  if (current?.id === id) set(null);
}

export function onSpawn(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export const spawnNow = (): Spawn | null => current;

/** The words the bud spells: one per Cell, the first `BUDDED`. */
export const budWords = (cells: readonly SpawnCell[]): string[] =>
  cells.slice(0, BUDDED).map((cell) => taskWord(cell.title));

/** The message a spawn pours in: its text, or its Cells' titles when it came with none. */
export const pourText = (spawn: Spawn): string =>
  spawn.text.trim() !== "" ? spawn.text : spawn.cells.map((cell) => cell.title).join(" ");

/** What plays of `spawn` now: the pour from its start, then the bud from its plan, when it has Cells to bud. */
export function spawnPart(spawn: Spawn): {
  readonly id: "the-pour" | "the-bud";
  readonly startedAt: number;
  readonly args: { readonly text?: string; readonly words?: readonly string[] };
} {
  const words = budWords(spawn.cells);
  return spawn.plannedAt !== null && words.length > 0
    ? { id: "the-bud", startedAt: spawn.plannedAt, args: { words } }
    : { id: "the-pour", startedAt: spawn.startedAt, args: { text: pourText(spawn) } };
}

/**
 * When the act goes, Unix milliseconds: once the Cells started and the bud
 * has landed them; at once for a spawn called off before its plan. One the
 * composer stopped telling goes after `SPAWN_WAITS`.
 */
export function spawnEndsAt(spawn: Spawn): number {
  const words = budWords(spawn.cells);
  if (spawn.plannedAt === null) return spawn.doneAt ?? spawn.startedAt + SPAWN_WAITS.plan;
  if (words.length === 0) return spawn.doneAt ?? spawn.plannedAt;
  const landed = spawn.plannedAt + theBud(words).end * 1000;
  return Math.max(landed, spawn.doneAt ?? spawn.plannedAt + SPAWN_WAITS.start);
}
