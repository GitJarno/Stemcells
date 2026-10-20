// Named scripts: the reels the render tool makes, and what tests replay. And the
// grid scenes, by id: each makes its card from a seed (and an act, from what was sent).

import type { Script } from "./aski.ts";
import type { SceneCard } from "./scene.ts";
import { theBud } from "./scenes/the-bud.ts";
import { thePond } from "./scenes/the-pond.ts";
import { theRain } from "./scenes/the-rain.ts";

export const SCENES: Record<string, Script> = {
  rest: { seed: 7, cues: [] },
  tour: {
    seed: 7,
    cues: [
      { at: 0.8, act: "walk", args: { to: 230 } },
      { at: 3.2, act: "walk", args: { to: -230 } },
      { at: 6.2, act: "walk", args: { to: 0 } },
      { at: 8.0, act: "hop" },
      { at: 9.6, act: "hello" },
      { at: 11.8, act: "listen" },
      { at: 15.8, act: "melt" },
    ],
  },
  dissolve: { seed: 7, cues: [{ at: 0.8, act: "dissolve" }] },
  dance: { seed: 7, cues: [{ at: 0.6, act: "dance", args: { bars: 12, bpm: 112 } }] },
  // Everything, in one take.
  reel: {
    seed: 7,
    x: -260,
    cues: [
      { at: 0.6, act: "walk", args: { to: 0 } },
      { at: 2.3, act: "hello" },
      { at: 4.6, act: "listen" },
      { at: 8.6, act: "dissolve" },
      { at: 16.6, act: "hop" },
      { at: 18.2, act: "dance", args: { bars: 8, bpm: 112 } },
      { at: 36.6, act: "melt" },
    ],
  },
};

export interface SceneArgs {
  readonly seed?: number;
  /** An act's task words, one per Cell it starts. */
  readonly words?: readonly string[];
}

export const SCENE_CARDS: Record<string, (args?: SceneArgs) => SceneCard> = {
  "the-rain": ({ seed }: SceneArgs = {}) => theRain(seed),
  "the-bud": ({ seed, words = ["tests", "docs", "fix"] }: SceneArgs = {}) => theBud(words, seed),
  "the-pond": ({ seed }: SceneArgs = {}) => thePond(seed),
};
