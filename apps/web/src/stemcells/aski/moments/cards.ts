// Aski's moments by id: each makes its card from its numbers. The scene
// worker draws them as it draws the scenes; the page reads their times.

import type { SceneCard } from "../scene.ts";
import { back } from "./back.ts";
import { bits } from "./bits.ts";
import { night } from "./night.ts";

/** A moment's numbers, sent with it to the worker. */
export interface MomentArgs {
  readonly seed?: number | undefined;
}

export const MOMENT_CARDS = {
  bits: ({ seed }: MomentArgs = {}) => bits(seed),
  back: ({ seed }: MomentArgs = {}) => back(seed),
  night: ({ seed }: MomentArgs = {}) => night(seed),
} as const satisfies Record<string, (args?: MomentArgs) => SceneCard>;

export type MomentId = keyof typeof MOMENT_CARDS;

/** The card of moment `id`, or none when there is no such moment. */
export const momentCard = (id: string, args?: MomentArgs): SceneCard | undefined =>
  Object.hasOwn(MOMENT_CARDS, id) ? MOMENT_CARDS[id as MomentId](args) : undefined;
