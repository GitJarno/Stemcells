// When each scene's moments fall, apart from how it draws them: whatever
// plays a scene (core keeping it on the stage, a screen showing its line)
// reads its length and its line here without carrying its pictures.

import words from "../strings/en.json" with { type: "json" };

/** Seconds: locking begins at `form`, no stream starts after `stop`, the letters close from `cond`. */
export const RAIN = { form: 1.1, stop: 3.6, cond: 4.9, open: 5.7, say: 6.3, end: 11 } as const;

/** Seconds, the scene's timeline: the pond fills from `fill`, the koi surfaces at `koi`, the water calms at `calm`, she rises at `paint`. */
export const POND = {
  drip: 1.3,
  fill: 1.6,
  koi: 3.0,
  dive: 6.4,
  rise: 7.9,
  calm: 10.2,
  paint: 12.2,
  say: 15.4,
  back: 19.4,
  drain: 20.2,
  cloud: 21.1,
  home: 22.4,
  end: 22.6,
} as const;

/** A scene's length, the moment reduced motion holds, and its one line with the moment it is said, all in seconds. */
export interface SceneTimes {
  readonly end: number;
  readonly still: number;
  readonly say: number;
  readonly line: string;
}

/** The scenes that play on Aski's stage by themselves. */
export const SCENE_TIMES: Readonly<Record<string, SceneTimes>> = {
  "the-rain": { end: RAIN.end, still: RAIN.end, say: RAIN.say, line: words["scene.rain"] },
  "the-pond": { end: POND.end, still: POND.say + 1, say: POND.say, line: words["scene.pond"] },
};
