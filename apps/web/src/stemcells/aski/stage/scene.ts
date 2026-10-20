// What Aski's stage shows of the scene core says is due or played. Pure,
// from the scene part and the screen's clock, so the rules are tested
// without a browser; `AskiStage.tsx` draws what this says through the scene
// worker.

import { SCENE_TIMES, type SceneTimes } from "../scenes/times.ts";

/** The `scene` part of `aski`, as core writes it. */
export interface ScenePart {
  readonly id: string;
  readonly seed: number;
  readonly startedAt?: number;
}

export type SceneShown =
  /** No scene, one this screen does not know, or one already over. */
  | { readonly kind: "none" }
  /** Due and not yet played: a screen showing the stage to someone plays it. */
  | { readonly kind: "due"; readonly id: string; readonly seed: number }
  /** Playing, `at` seconds in. */
  | {
      readonly kind: "playing";
      readonly id: string;
      readonly seed: number;
      readonly startedAt: number;
      readonly at: number;
      readonly times: SceneTimes;
    };

const NONE: SceneShown = { kind: "none" };

/**
 * What the stage shows of a scene part at `now` (ms, the screen's clock). A
 * screen whose clock runs behind the Mac's starts the scene from its start
 * rather than before it.
 */
export function sceneShown(part: ScenePart | undefined, now: number): SceneShown {
  const times = part === undefined ? undefined : SCENE_TIMES[part.id];
  if (part === undefined || times === undefined) return NONE;
  if (part.startedAt === undefined) return { kind: "due", id: part.id, seed: part.seed };
  const at = Math.max(0, (now - part.startedAt) / 1000);
  if (at >= times.end) return NONE;
  return { kind: "playing", id: part.id, seed: part.seed, startedAt: part.startedAt, at, times };
}

/** The line the stage says over a scene: its own from its moment to its end, else none. */
export const sceneLine = (shown: SceneShown): string | undefined =>
  shown.kind === "playing" && shown.at >= shown.times.say ? shown.times.line : undefined;

/** When, on the screen's clock, what a playing scene shows next changes: its line, then its end. */
export function sceneNext(shown: SceneShown): number | undefined {
  if (shown.kind !== "playing") return undefined;
  const at = shown.at < shown.times.say ? shown.times.say : shown.times.end;
  return shown.startedAt + at * 1000;
}
