// Aski's moments by id: each makes its card from its numbers. The scene
// worker draws them as it draws the scenes; the page reads their times.

import type { SceneCard } from "../scene.ts";
import { back } from "./back.ts";
import { bits } from "./bits.ts";
import { clear } from "./clear.ts";
import { haul } from "./haul.ts";
import { many } from "./many.ts";
import { type LinePlace, news } from "./news.ts";
import { night } from "./night.ts";

/** A moment's numbers, sent with it to the worker. */
export interface MomentArgs {
  readonly seed?: number | undefined;
  /** How many: Cells landed, asks answered. */
  readonly n?: number | undefined;
  /** Whole hours a run took. */
  readonly hours?: number | undefined;
  /** The titles of the Cells a message started. */
  readonly titles?: readonly string[] | undefined;
  /** Where the line stands on the stage, for a moment whose eye goes to it. */
  readonly line?: LinePlace | undefined;
}

export const MOMENT_CARDS = {
  bits: ({ seed }: MomentArgs = {}) => bits(seed),
  back: ({ seed }: MomentArgs = {}) => back(seed),
  night: ({ seed }: MomentArgs = {}) => night(seed),
  news: ({ n, line, seed }: MomentArgs = {}) => news(n, line, seed),
  many: ({ titles, seed }: MomentArgs = {}) => many(titles, seed),
  clear: ({ n, seed }: MomentArgs = {}) => clear(n, seed),
  haul: ({ hours, seed }: MomentArgs = {}) => haul(hours, seed),
} as const satisfies Record<string, (args?: MomentArgs) => SceneCard>;

export type MomentId = keyof typeof MOMENT_CARDS;

/** The card of moment `id`, or none when there is no such moment. */
export const momentCard = (id: string, args?: MomentArgs): SceneCard | undefined =>
  Object.hasOwn(MOMENT_CARDS, id) ? MOMENT_CARDS[id as MomentId](args) : undefined;
