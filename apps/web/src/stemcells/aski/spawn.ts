// Aski's half of a spawn (stemcells/docs/interaction.md, The spawn), for a
// composer that starts several Cells from one message. The composer says when
// the words go (`spawnStart`), when the plan is in and the streams leave
// (`spawnPlanned`), and when the last stream has landed or the spawn is off
// (`spawnDone`). The words and the streams are the composer's to draw; Aski
// watches the words in and round, throws once a stream, and fades.
// `AskiSpawn` plays it at the rect the composer gives, Aski centred in it;
// under Reduce Motion it plays nothing. The calls are safe in any order: a
// repeat, or a call with no spawn to belong to, does nothing.

import { lookToward, type ThrowTimes, thrown, type WaitTimes } from "./scenes/the-throw.ts";

/** A box in viewport CSS pixels (`getBoundingClientRect`). */
export interface SpawnRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** A Cell the spawn starts: its title, and its pane's box once the pane is open, for Aski's eyes. */
export interface SpawnCell {
  readonly title: string;
  readonly to?: SpawnRect | undefined;
}

export interface Spawn {
  readonly id: number;
  /** Where Aski stands, centred. */
  readonly rect: SpawnRect;
  readonly cells: readonly SpawnCell[];
  /** Unix milliseconds; null until it happens. */
  readonly startedAt: number;
  readonly plannedAt: number | null;
  readonly doneAt: number | null;
}

/** An act's times, seconds, from the motion tokens: the words' pour and orbit, the streams' gap and flight, and a pulse. */
export type SpawnTimes = WaitTimes & ThrowTimes;

/** Milliseconds Aski waits for the composer's next call before it goes on its own: a plan, then the streams landing. */
export const SPAWN_WAITS = { plan: 120_000, start: 10_000 } as const;

let current: Spawn | null = null;
const listeners = new Set<() => void>();

function set(next: Spawn | null): void {
  current = next;
  for (const listener of listeners) listener();
}

/** The words go, to start `cells` (none yet, when a plan will pick them). One spawn plays at a time. */
export function spawnStart(rect: SpawnRect, cells: readonly SpawnCell[] = []): void {
  if (current !== null && current.doneAt === null) return;
  set({
    id: (current?.id ?? 0) + 1,
    rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
    cells,
    startedAt: Date.now(),
    plannedAt: null,
    doneAt: null,
  });
}

/** The plan is in and the streams leave: `cells` in the order their streams go, with their panes' boxes, or those it started with. */
export function spawnPlanned(cells?: readonly SpawnCell[]): void {
  if (current === null || current.plannedAt !== null || current.doneAt !== null) return;
  set({ ...current, cells: cells ?? current.cells, plannedAt: Date.now() });
}

/** The last stream has landed, or the spawn is off. */
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

const middle = (r: SpawnRect): readonly [number, number] => [r.x + r.width / 2, r.y + r.height / 2];

/** Where Aski's eyes look as each stream leaves, in the composer's order (it sends the nearest pane's first): straight ahead for a Cell whose pane isn't known. */
export function throwLooks(spawn: Spawn): (readonly [number, number])[] {
  const [ax, ay] = middle(spawn.rect);
  return spawn.cells.map((cell) =>
    cell.to === undefined ? [0, 0] : lookToward(middle(cell.to)[0] - ax, middle(cell.to)[1] - ay),
  );
}

/** What plays of `spawn` now: Aski waiting from its start, then throwing from its plan. */
export function spawnPart(
  spawn: Spawn,
  times: SpawnTimes,
): {
  readonly id: "the-wait" | "the-throw";
  readonly startedAt: number;
  readonly args: {
    readonly n?: number;
    readonly looks?: readonly (readonly [number, number])[];
    readonly times: Readonly<Record<string, number>>;
  };
} {
  return spawn.plannedAt === null
    ? {
        id: "the-wait",
        startedAt: spawn.startedAt,
        args: { times: { lookIn: times.lookIn, turn: times.turn } },
      }
    : {
        id: "the-throw",
        startedAt: spawn.plannedAt,
        args: {
          n: Math.max(1, spawn.cells.length),
          looks: throwLooks(spawn),
          times: { stagger: times.stagger, travel: times.travel, flick: times.flick },
        },
      };
}

/**
 * When Aski goes, Unix milliseconds: once the last stream has landed and
 * Aski has thrown them all; at once for a spawn called off before its plan.
 * One the composer stopped telling goes after `SPAWN_WAITS`.
 */
export function spawnEndsAt(spawn: Spawn, times: SpawnTimes): number {
  if (spawn.plannedAt === null) return spawn.doneAt ?? spawn.startedAt + SPAWN_WAITS.plan;
  const threw = spawn.plannedAt + thrown(spawn.cells.length, times) * 1000;
  return Math.max(threw, spawn.doneAt ?? spawn.plannedAt + SPAWN_WAITS.start);
}
