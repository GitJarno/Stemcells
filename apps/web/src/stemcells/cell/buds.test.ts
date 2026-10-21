import { describe, expect, it } from "vite-plus/test";

import { BUDS_MOST } from "./activity.ts";
import { type Bud, type BudPlace, BudRow } from "./buds.ts";
import { SCENES } from "./kit.ts";
import { onBeat } from "./scene.ts";

/** Seconds a step takes: its frames on its beat. */
const stepping = (n: number) => {
  const scene = SCENES.get(`bud/out/${n}`)!;
  return scene.frames.length / onBeat(scene.fps);
};
const T = 1_000;

const working = (name: string): Bud => ({ name, provider: "claudeAgent", status: "running" });
const ended = (bud: Bud, status = "completed"): Bud => ({ ...bud, status });
const a = working("thread-a");
const b = working("thread-b");
const c = working("thread-c");

const names = (places: readonly BudPlace[]) => places.map((place) => place.bud.name);
const spot = (places: readonly BudPlace[], name: string) =>
  places.find((place) => place.bud.name === name);

/** A row with `buds` stepped out and standing by `T + 10`. */
function standing(...buds: Bud[]): BudRow {
  const row = new BudRow();
  let at = T;
  for (let n = 1; n <= buds.length; n++) {
    row.at(buds, at);
    at += stepping(n);
  }
  row.at(buds, T + 10);
  return row;
}

describe("the buds beside a Cell, each a Subcell", () => {
  it("steps a Subcell's bud out from behind the Cell as it starts, then keeps it just past it", () => {
    const row = new BudRow();
    expect(row.at([], T)).toEqual([]);
    const first = spot(row.at([a], T), a.name)!;
    expect(first.x, "behind the Cell's box").toBeLessThan(0);
    const stands = spot(row.at([a], T + stepping(1)), a.name)!;
    expect(stands.x, "past the Cell's box").toBeGreaterThanOrEqual(0);
    expect(stands.bud).toEqual(a);
  });

  it("steps two Subcells out in turn, never both at once, the newer nearer the Cell", () => {
    const row = new BudRow();
    expect(names(row.at([a, b], T))).toEqual([a.name]);
    const second = row.at([a, b], T + stepping(1));
    expect(names(second), "the one stepping is drawn under the other").toEqual([b.name, a.name]);
    expect(spot(second, b.name)!.x).toBeLessThan(0);
    const both = row.at([a, b], T + stepping(1) + stepping(2));
    expect(spot(both, b.name)!.x).toBeGreaterThanOrEqual(0);
    expect(spot(both, a.name)!.x).toBeGreaterThan(spot(both, b.name)!.x);
  });

  it("hops the newest bud home once its Subcell has ended, its step out backwards", () => {
    const row = standing(a, b);
    const was = row.at([a, b], T + 20);
    const gone = T + 30;
    row.at([a, ended(b)], gone);
    expect(names(row.at([a, ended(b)], gone + 2.9)).toSorted()).toEqual([a.name, b.name]);
    const first = row.at([a, ended(b)], gone + 3);
    expect(spot(first, b.name)!.x).toBe(spot(was, b.name)!.x);
    const last = row.at([a, ended(b)], gone + 3 + stepping(2) - 0.01);
    expect(spot(last, b.name)!.x, "back behind the Cell").toBeLessThan(0);
    expect(spot(last, a.name)!.x, "the other closes up").toBe(spot(was, b.name)!.x);
    expect(names(row.at([a, ended(b)], gone + 3 + stepping(2)))).toEqual([a.name]);
  });

  it("walks an older bud home behind the newer one, which keeps its place", () => {
    const row = standing(a, b);
    const was = row.at([a, b], T + 20);
    const gone = T + 30;
    row.at([ended(a), b], gone);
    let ahead = Number.POSITIVE_INFINITY;
    for (let t = gone + 3; t < gone + 3 + 2 * stepping(2); t += 1 / 12) {
      const places = row.at([ended(a), b], t);
      expect(names(places), "it walks under the one that stays").toEqual([a.name, b.name]);
      expect(spot(places, b.name)!.x).toBe(spot(was, b.name)!.x);
      expect(spot(places, a.name)!.x).toBeLessThanOrEqual(ahead);
      ahead = spot(places, a.name)!.x;
    }
    expect(ahead, "back behind the Cell").toBeLessThan(0);
    expect(names(row.at([ended(a), b], gone + 3 + 2 * stepping(2)))).toEqual([b.name]);
  });

  it("keeps a bud standing while its Subcell moves to the background", () => {
    const row = standing(a);
    row.at([], T + 20);
    expect(names(row.at([a], T + 22))).toEqual([a.name]);
    expect(names(row.at([], T + 24))).toEqual([a.name]);
    expect(names(row.at([], T + 26.9))).toEqual([a.name]);
  });

  it("wears the last status heard for its Subcell while it waits to go home", () => {
    const row = standing(a);
    expect(spot(row.at([ended(a, "failed")], T + 20), a.name)!.bud.status).toBe("failed");
    expect(spot(row.at([], T + 21), a.name)!.bud.status, "nothing newer heard").toBe("failed");
  });

  it("stands its most buds at once; another Subcell's steps out once one has gone home", () => {
    const row = standing(a, b);
    expect(names(row.at([a, b, c], T + 20)).toSorted()).toEqual([a.name, b.name]);
    expect(BUDS_MOST, "the row's scenes stand two").toBe(2);
    row.at([ended(a), b, c], T + 30);
    row.at([ended(a), b, c], T + 33);
    row.at([ended(a), b, c], T + 33 + 2 * stepping(2));
    expect(names(row.at([ended(a), b, c], T + 33 + 3 * stepping(2))).toSorted()).toEqual([
      b.name,
      c.name,
    ]);
  });

  it("held still, stands the Subcells at work at once, and goes on from there", () => {
    const row = new BudRow();
    expect(names(row.at([a, b], undefined)).toSorted()).toEqual([a.name, b.name]);
    expect(names(row.at([ended(a), b], undefined))).toEqual([b.name]);
    expect(row.at([], undefined)).toEqual([]);
  });
});
