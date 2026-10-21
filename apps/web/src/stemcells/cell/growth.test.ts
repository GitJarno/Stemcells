import { describe, expect, it } from "vite-plus/test";

import { aloneIn, FLEX_MS, strengthOf } from "./growth.ts";
import { CHEERS, REST, SCENES, STRENGTH_ARMS, STRENGTHS, TOOLS } from "./kit.ts";
import { hero } from "./rig.ts";
import { FLEX, grown, packLook, sceneOf } from "./scene.ts";

const MINUTE = 60_000;
const bare = packLook([]);

/** Columns of `rows` with anything drawn in them. */
const reach = (rows: readonly string[]) => {
  const columns = rows.flatMap((row) => [...row].flatMap((cell, x) => (cell === "." ? [] : [x])));
  return { left: Math.min(...columns), right: Math.max(...columns) };
};

describe("how strong a Cell grows from the time it worked alone", () => {
  it("grows nubs at 10 min, arms at 30 and biceps at 2 h", () => {
    expect(strengthOf(0)).toBeUndefined();
    expect(strengthOf(10 * MINUTE - 1)).toBeUndefined();
    expect(strengthOf(10 * MINUTE)).toBe("nubs");
    expect(strengthOf(30 * MINUTE)).toBe("arms");
    expect(strengthOf(120 * MINUTE - 1)).toBe("arms");
    expect(strengthOf(120 * MINUTE)).toBe("biceps");
    expect(FLEX_MS).toBe(30 * MINUTE);
  });

  it("counts a run's time less its waits on you, clipped to the run, overlaps once", () => {
    const run = { from: 0, to: 60 * MINUTE };
    expect(aloneIn({ ...run, waits: [] })).toBe(60 * MINUTE);
    expect(aloneIn({ ...run, waits: [{ from: 10 * MINUTE, to: 20 * MINUTE }] })).toBe(50 * MINUTE);
    expect(
      aloneIn({
        ...run,
        waits: [
          { from: 15 * MINUTE, to: 25 * MINUTE },
          { from: 10 * MINUTE, to: 20 * MINUTE },
        ],
      }),
      "two waits at once count once",
    ).toBe(45 * MINUTE);
    expect(
      aloneIn({ ...run, waits: [{ from: 50 * MINUTE, to: Infinity }] }),
      "a wait never answered runs to the landing",
    ).toBe(50 * MINUTE);
    expect(aloneIn({ ...run, waits: [{ from: -5 * MINUTE, to: 70 * MINUTE }] })).toBe(0);
  });
});

describe("a grown Cell's arms", () => {
  it("are the rig's own, held at rest, reaching further each strength, inside what a 2× display draws", () => {
    let widest = reach(hero(REST).rows);
    for (const strength of STRENGTHS) {
      const rows = sceneOf(grown(bare, strength), "idle")!.hero[0]!;
      const spread = reach(rows);
      expect(spread.left, strength).toBeLessThan(widest.left);
      expect(spread.right, strength).toBeGreaterThan(widest.right);
      // The margin a 2× display draws past the box reaches the hero's whole grid but one cell.
      expect(spread.left, strength).toBeGreaterThanOrEqual(0);
      expect(spread.right, strength).toBeLessThanOrEqual(31);
      widest = spread;
    }
  });

  it("leave the bare Cell as the original drew it, and name scenes of their own", () => {
    expect(grown(bare, undefined)).toBe(bare);
    expect(grown(bare, "arms").name).not.toBe(bare.name);
    expect(grown(bare, "arms", true).name).not.toBe(grown(bare, "arms").name);
  });

  it("give way to a move's own arm, and to a tool held in a hand", () => {
    const right = (rows: readonly string[]) => rows.map((row) => row.slice(16));
    const left = (rows: readonly string[]) => rows.map((row) => row.slice(0, 16));
    // The mic's song: its right arm holds it out, then drops, the mic still at that hand.
    const song = SCENES.get("busy/4")!;
    expect(TOOLS.get(song.held!)?.attach).toBe("handR");
    const dropped = song.frames.findIndex((frame) => frame.pose.arms.length === 0);
    const strong = sceneOf(grown(bare, "arms"), "busy/4")!.hero;
    const plain = sceneOf(bare, "busy/4")!.hero;
    expect(right(strong[dropped]!)).toEqual(right(plain[dropped]!));
    expect(left(strong[dropped]!)).not.toEqual(left(plain[dropped]!));
    // Its raised arm stays the move's.
    expect(right(strong[0]!)).toEqual(right(plain[0]!));
  });

  it("bulge with biceps, in every move that shows an arm", () => {
    const arm = { side: 1, at: 0.5, dx: 4, dy: 0 };
    const lean = hero({ ...REST, arms: [arm] }).rows;
    const strong = hero({
      ...REST,
      arms: [{ ...arm, bulge: STRENGTH_ARMS.get("biceps")!.bulge }],
    }).rows;
    expect(strong.join("")).not.toBe(lean.join(""));
    expect(strong.join("").split("L").length).toBeGreaterThan(lean.join("").split("L").length);
    expect(STRENGTH_ARMS.get("arms")!.bulge, "arms grow no biceps").toBeUndefined();
  });

  it("stand aside where the flex draws its own, and hold at rest around them", () => {
    const flex = CHEERS.get(FLEX)!;
    expect(flex.meta.ownArms).toBe(true);
    const flexing = sceneOf(grown(bare, "biceps", true), "happy")!.hero;
    const plain = sceneOf(grown(bare, undefined, true), "happy")!.hero;
    expect(flexing).not.toEqual(sceneOf(grown(bare, "biceps"), "happy")!.hero);
    flex.frames.forEach((frame, i) => {
      if (frame.layers.length > 0)
        expect(flexing[i], `frame ${i}: the flex's own arms`).toEqual(plain[i]);
      else expect(flexing[i], `frame ${i}: the Cell's arms at rest`).not.toEqual(plain[i]);
    });
  });
});
