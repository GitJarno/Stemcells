// The news: the person was away an hour or more and Cells landed
// meanwhile. Aski is asleep as they come back, wakes, and one eye goes over
// to become the cursor that types the news; when it is typed, the eye
// comes home.

import { type Stage } from "../grid.ts";
import { ease, lerp, unlerp } from "../math.ts";
import { cloudAtRest, type EyePlace, type SceneCard } from "../scene.ts";
import words from "../strings/en.json" with { type: "json" };
import { TYPING, typingFor } from "./line.ts";
import { blinkFrom, eyesLooking, squareOf } from "./stage.ts";

/** Seconds: asleep until `wake`, the eye goes over from `go` until `there`, and the line is typed from `say`. */
export const NEWS = { wake: 0.9, go: 1.5, there: 2.2, say: 2.4 } as const;
/** How long the eye takes to come home. */
const HOME_IN = 0.8;

/** Where the line is on the stage, in cells: where its cursor stands as it starts, and as it ends. */
export interface LinePlace {
  readonly from: readonly [number, number];
  readonly to: readonly [number, number];
}

/** What the news says. */
export const newsLine = (landed: number): string =>
  words["moment.news"].replace("{n}", String(landed));

/** Where the line stands on a stage when the page hasn't said: just right of Aski's square, at its middle. */
const lineOn = (stage: Stage, line: string): LinePlace => {
  const sq = squareOf(stage),
    from = [sq.right + 3, sq.middle] as const;
  return { from, to: [from[0] + line.length * 2, sq.middle] };
};

export function news(landed = 3, place?: LinePlace, seed = 7): SceneCard {
  const line = newsLine(landed),
    typed = NEWS.say + (typingFor(line) + TYPING.hold) / 1000,
    home = typed + HOME_IN,
    end = home + 1;

  /** The eyes, the right one off to the line and back. */
  function eyesAt(t: number, stage: Stage): EyePlace | null {
    if (t < NEWS.go || t >= home) return null;
    const rest = eyesLooking(stage, [0, 0]),
      glance = eyesLooking(stage, [7, 0]),
      at = place ?? lineOn(stage, line);
    if (t < NEWS.there) {
      const v = ease.inOutCubic(unlerp(NEWS.go, NEWS.there, t));
      const [hx, hy] = rest.at[1]!;
      return {
        at: [glance.at[0], [lerp(hx, at.from[0], v), lerp(hy, at.from[1], v)]],
        rows: rest.rows,
      };
    }
    // The line's own cursor stands in for the eye while it types.
    if (t < typed) return { at: [glance.at[0]], rows: rest.rows };
    const v = ease.inOutCubic(unlerp(typed, home, t));
    const [hx, hy] = rest.at[1]!;
    return { at: [glance.at[0], [lerp(at.to[0], hx, v), lerp(at.to[1], hy, v)]], rows: rest.rows };
  }

  return {
    id: "news",
    seed,
    beats: { ...NEWS, typed, home },
    end,
    // Awake, both eyes home, the news beside it.
    still: home + 0.2,
    lines: [line],
    home: true,
    eyes: (t) => (t < NEWS.wake ? 1 : blinkFrom(t, NEWS.wake - 0.07)),
    mood: (t) => (t < NEWS.wake ? "asleep" : undefined),
    eyesAt,
    frame: (_t, stage) => cloudAtRest(stage),
  };
}
