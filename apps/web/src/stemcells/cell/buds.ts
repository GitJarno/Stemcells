// The buds beside a Cell while its Subcells work: a row of small Cells at
// its right, each one a Subcell at work, drawn as the transcript draws it
// (`SubcellMark`). They stand, step and hop where the bud scenes put their
// buds (`bud/1`, `bud/2` in `art/moves/work.json`): as a Subcell starts, its
// bud steps out of the Cell's side (`bud/out/<n>`); once it has ended, its
// bud hops home into it, the step played backwards. The row moves one bud
// at a time, so two Subcells starting together step out in turn.

import { ACTIVITY_DEBOUNCE, BUDS_MOST } from "./activity.ts";
import { REST, SCENES } from "./kit.ts";
import { BOX } from "./look.ts";
import { hero } from "./rig.ts";
import { DETAIL, onBeat } from "./scene.ts";
import { anchorOf } from "./sprite.ts";

/**
 * How long a Subcell must be gone before its bud goes home, in seconds, as
 * a new activity must last before it shows: a turn handing its subagents to
 * the background loses sight of them for a moment.
 */
const STAYS = ACTIVITY_DEBOUNCE / 1000;

/** A Subcell a bud stands for: its name (its thread's id, which deals its look), its provider, and its status as upstream names it. */
export interface Bud {
  readonly name: string;
  readonly provider?: string | undefined;
  readonly status?: string | undefined;
}

/**
 * A bud in a frame of the row: where its box starts past the Cell's, and
 * how high it hops, in hero cells of the Cell. A bud is drawn at half the
 * Cell's size, so a cell of its miniature is a hero cell of the Cell's.
 */
export interface BudPlace {
  readonly bud: Bud;
  readonly x: number;
  readonly lift: number;
}

/** Whether a Subcell is at work: upstream's statuses of work in flight. */
const atWork = (bud: Bud): boolean =>
  bud.status === "pending" || bud.status === "running" || bud.status === "waiting";

/** The ground the bud scenes stand their buds on: the Cell's, on its box's grid of hero cells. */
const GROUND = (() => {
  const at = anchorOf(hero(REST), "ground");
  return { x: at.x - DETAIL.x, y: at.y - DETAIL.y };
})();

type Spot = Omit<BudPlace, "bud">;

/**
 * A bud scene: each frame its buds' spots in layer order, a bud's box
 * centred where the scene centres its bud, on its feet; and its layers in
 * order of how near the Cell they stand in its first frame, which is how a
 * row's buds are cast to them.
 */
interface Moves {
  readonly fps: number;
  readonly frames: readonly (readonly Spot[])[];
  readonly layers: readonly number[];
}

const scenes = new Map<string, Moves>();

function movesOf(key: string): Moves {
  let moves = scenes.get(key);
  if (moves === undefined) {
    const scene = SCENES.get(key);
    const frames = (scene?.frames ?? []).map((frame) =>
      frame.layers.map(({ art, hotspot }) => ({
        x: GROUND.x + Math.max(...art.map((row) => row.length)) / 2 - hotspot.x - BOX.width / 2,
        lift: hotspot.y - art.length - (GROUND.y - DETAIL.height),
      })),
    );
    const first = frames[0] ?? [];
    moves = {
      fps: onBeat(scene?.fps ?? 1),
      frames,
      layers: first.map((_, i) => i).toSorted((i, j) => first[i]!.x - first[j]!.x),
    };
    scenes.set(key, moves);
  }
  return moves;
}

/**
 * `buds` in a frame, cast to `layers` in turn, the ones `stepping` drawn
 * first, under the rest, which go nearest the Cell first.
 */
function placed(
  buds: readonly Bud[],
  spots: readonly Spot[],
  layers: readonly number[],
  stepping: ReadonlySet<string> = new Set(),
): BudPlace[] {
  return buds
    .flatMap((bud, i) => {
      const spot = spots[layers[i] ?? -1];
      return spot === undefined ? [] : [{ bud, ...spot }];
    })
    .toSorted(
      (a, b) => Number(stepping.has(b.bud.name)) - Number(stepping.has(a.bud.name)) || a.x - b.x,
    );
}

/** A step the row takes: its frames on its rate, from when (`clockSeconds`), and the buds that stand after it. */
interface Step {
  readonly frames: readonly (readonly BudPlace[])[];
  readonly fps: number;
  readonly at: number;
  readonly after: readonly Bud[];
}

/** `newcomer` stepping out from behind the Cell to stand nearest it, the buds `standing` making room. */
function stepOut(standing: readonly Bud[], newcomer: Bud, at: number): Step {
  const after = [newcomer, ...standing];
  const out = movesOf(`bud/out/${after.length}`);
  const stepping = new Set([newcomer.name]);
  return {
    frames: out.frames.map((spots) => placed(after, spots, out.layers, stepping)),
    fps: out.fps,
    at,
    after,
  };
}

/**
 * `leaving` hopping home into the Cell. The nearest bud plays its step out
 * backwards, the others closing up. One farther off walks behind the
 * nearer to the nearest's spot, its own step out backwards, then home the
 * nearest's way; the rest stand where one bud fewer stands.
 */
function stepHome(standing: readonly Bud[], leaving: Bud, at: number): Step {
  const after = standing.filter((bud) => bud.name !== leaving.name);
  const out = movesOf(`bud/out/${standing.length}`);
  const back = out.frames.toReversed();
  const stepping = new Set([leaving.name]);
  const index = standing.indexOf(leaving);
  if (index === 0)
    return {
      frames: back.map((spots) => placed(standing, spots, out.layers, stepping)),
      fps: out.fps,
      at,
      after,
    };
  const rest = movesOf(`bud/${after.length}`);
  const walk = [
    ...back.map((spots) => spots[out.layers[index] ?? -1]),
    ...back.map((spots) => spots[out.layers[0] ?? -1]),
  ];
  return {
    frames: walk.map((spot) => [
      ...(spot === undefined ? [] : [{ bud: leaving, ...spot }]),
      ...placed(after, rest.frames[0] ?? [], rest.layers),
    ]),
    fps: out.fps,
    at,
    after,
  };
}

export class BudRow {
  /** The buds standing, nearest the Cell first: the newest stands nearest. */
  #standing: readonly Bud[] = [];
  #step: Step | undefined;
  /** Since when each standing bud's Subcell has been at work no more (`clockSeconds`). */
  readonly #gone = new Map<string, number>();

  /**
   * The buds the row shows at `seconds` (`clockSeconds`) for a Cell's
   * `subcells`, oldest first, in the order they are drawn. A Subcell's bud
   * steps out as it starts, while there is room (`BUDS_MOST`), and goes
   * home once its Subcell has been at work no more for `STAYS`; it wears
   * the last status heard for it. Held still (no `seconds`), the row stands
   * the Subcells at work at once.
   */
  at(subcells: readonly Bud[], seconds: number | undefined): readonly BudPlace[] {
    const heard = new Map(subcells.map((bud) => [bud.name, bud]));
    const latest = (bud: Bud) => heard.get(bud.name) ?? bud;
    const working = subcells.filter(atWork);
    const busy = new Set(working.map((bud) => bud.name));
    const stands = (bud: Bud) => this.#standing.some((one) => one.name === bud.name);
    this.#standing = this.#standing.map(latest);
    if (seconds === undefined) {
      const fresh = working.filter((bud) => !stands(bud)).toReversed();
      const kept = this.#standing.filter((bud) => busy.has(bud.name));
      this.#standing = [...fresh, ...kept].slice(0, BUDS_MOST);
      this.#step = undefined;
      this.#gone.clear();
      const still = movesOf(`bud/${this.#standing.length}`);
      return placed(this.#standing, still.frames[0] ?? [], still.layers);
    }
    if (this.#step !== undefined) {
      const { frames, fps, at, after } = this.#step;
      const frame = frames[Math.max(0, Math.floor((seconds - at) * fps))];
      if (frame !== undefined) return frame.map((place) => ({ ...place, bud: latest(place.bud) }));
      this.#standing = after.map(latest);
      this.#step = undefined;
    }
    for (const bud of this.#standing) {
      if (busy.has(bud.name)) this.#gone.delete(bud.name);
      else if (!this.#gone.has(bud.name)) this.#gone.set(bud.name, seconds);
    }
    const newcomer = working.find((bud) => !stands(bud));
    if (newcomer !== undefined && this.#standing.length < BUDS_MOST) {
      this.#step = stepOut(this.#standing, newcomer, seconds);
      return this.at(subcells, seconds);
    }
    const leaving = this.#standing.find(
      (bud) => seconds - (this.#gone.get(bud.name) ?? seconds) >= STAYS,
    );
    if (leaving !== undefined) {
      this.#gone.delete(leaving.name);
      this.#step = stepHome(this.#standing, leaving, seconds);
      return this.at(subcells, seconds);
    }
    const row = movesOf(`bud/${this.#standing.length}`);
    const frame = row.frames[Math.trunc(seconds * row.fps) % row.frames.length];
    return frame === undefined ? [] : placed(this.#standing, frame, row.layers);
  }
}
