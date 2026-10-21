// The buds beside a Cell while its subagents work: a row of small Cells at
// its right (`bud/1`, `bud/2` in `art/moves/work.json`). As a subagent
// starts, one steps out of the Cell's side (`bud/out/<n>`); once one has
// ended, a bud hops home into it, the same step played backwards. The row
// moves one bud at a time, so two subagents starting together step out in
// turn.

import { ACTIVITY_DEBOUNCE } from "./activity.ts";
import { type CellScene, type MiniFrame, onBeat } from "./scene.ts";

/**
 * How long fewer subagents must last before a bud goes home, in seconds, as
 * a new activity must last before it shows: a turn handing its subagents to
 * the background loses sight of them for a moment.
 */
const STAYS = ACTIVITY_DEBOUNCE / 1000;

/** Where the row is: the buds standing, and the step it is taking, from when (`clockSeconds`). */
interface Step {
  readonly from: number;
  readonly to: number;
  readonly at: number;
}

export class BudRow {
  readonly #scene: (key: string) => CellScene | undefined;
  #standing = 0;
  #step: Step | undefined;
  /** Since when fewer buds than stand have been wanted. */
  #fewerSince: number | undefined;

  /** `scene`: `sceneOf` for the bud scenes, in the look buds wear. */
  constructor(scene: (key: string) => CellScene | undefined) {
    this.#scene = scene;
  }

  /**
   * The frame the row shows at `seconds` (`clockSeconds`) on its way to
   * `wanted` buds; undefined when no bud stands. A bud steps out at once and
   * goes home once fewer have been wanted for `STAYS`. Held still (no
   * `seconds`), it stands the buds wanted at once.
   */
  at(wanted: number, seconds: number | undefined): MiniFrame | undefined {
    if (seconds === undefined) {
      this.#standing = wanted;
      this.#step = undefined;
      return wanted === 0 ? undefined : this.#scene(`bud/${wanted}`)?.mini[0];
    }
    if (this.#step !== undefined) {
      const { from, to, at } = this.#step;
      const step = this.#scene(`bud/out/${Math.max(from, to)}`);
      const frames = step?.mini ?? [];
      const index = Math.max(0, Math.floor((seconds - at) * onBeat(step?.fps ?? 1)));
      if (index < frames.length) return frames[to > from ? index : frames.length - 1 - index];
      this.#standing = to;
      this.#step = undefined;
    }
    if (wanted >= this.#standing) this.#fewerSince = undefined;
    else this.#fewerSince ??= seconds;
    const due = wanted > this.#standing || seconds - (this.#fewerSince ?? seconds) >= STAYS;
    if (wanted !== this.#standing && due) {
      this.#step = {
        from: this.#standing,
        to: this.#standing + Math.sign(wanted - this.#standing),
        at: seconds,
      };
      return this.at(wanted, seconds);
    }
    if (this.#standing === 0) return undefined;
    const row = this.#scene(`bud/${this.#standing}`);
    return row?.mini[Math.trunc(seconds * onBeat(row.fps)) % row.mini.length];
  }
}
