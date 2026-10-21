import { describe, expect, it } from "vite-plus/test";

import { BudRow } from "./buds.ts";
import { onBeat, packLook, sceneOf } from "./scene.ts";

const bare = packLook([]);
const scene = (key: string) => sceneOf(bare, key)!;
const row = () => new BudRow((key) => sceneOf(bare, key));
/** Seconds a step takes: its frames on its beat. */
const stepping = (n: number) =>
  scene(`bud/out/${n}`).mini.length / onBeat(scene(`bud/out/${n}`).fps);
const T = 1_000;

describe("the buds beside a Cell", () => {
  it("steps a bud out of the Cell as a subagent starts, then keeps it standing", () => {
    const buds = row();
    expect(buds.at(0, T)).toBeUndefined();
    expect(buds.at(1, T)).toBe(scene("bud/out/1").mini[0]);
    const standing = buds.at(1, T + stepping(1));
    expect(scene("bud/1").mini).toContain(standing);
  });

  it("steps two subagents' buds out in turn, never both at once", () => {
    const buds = row();
    expect(buds.at(2, T)).toBe(scene("bud/out/1").mini[0]);
    expect(buds.at(2, T + stepping(1))).toBe(scene("bud/out/2").mini[0]);
    expect(scene("bud/2").mini).toContain(buds.at(2, T + stepping(1) + stepping(2)));
  });

  it("hops a bud home once its subagent has ended: the step out, backwards", () => {
    const buds = row();
    buds.at(1, T);
    buds.at(1, T + stepping(1));
    const home = scene("bud/out/1").mini;
    const ended = T + 10;
    expect(scene("bud/1").mini).toContain(buds.at(0, ended));
    expect(scene("bud/1").mini).toContain(buds.at(0, ended + 2.9));
    expect(buds.at(0, ended + 3)).toBe(home.at(-1));
    expect(buds.at(0, ended + 3 + stepping(1) - 0.01)).toBe(home[0]);
    expect(buds.at(0, ended + 3 + stepping(1))).toBeUndefined();
  });

  it("keeps a bud standing while its subagent moves to the background", () => {
    const buds = row();
    buds.at(1, T);
    buds.at(1, T + stepping(1));
    buds.at(0, T + 10);
    expect(scene("bud/1").mini).toContain(buds.at(1, T + 12));
    expect(scene("bud/1").mini).toContain(buds.at(0, T + 14));
    expect(scene("bud/1").mini).toContain(buds.at(0, T + 16.9));
  });

  it("held still, stands the buds wanted at once", () => {
    const buds = row();
    expect(buds.at(2, undefined)).toBe(scene("bud/2").mini[0]);
    expect(buds.at(0, undefined)).toBeUndefined();
  });
});
