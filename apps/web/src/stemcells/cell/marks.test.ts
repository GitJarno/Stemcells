import { describe, expect, it } from "vite-plus/test";

import { CHEERS, DIFF_MARKS, SCENES } from "./kit.ts";
import { FLEX, grown, marked, packLook, pastDetail, sceneOf } from "./scene.ts";

const bare = packLook([]);
const both = { added: true, removed: true };
const none = { added: false, removed: false };

/** How many cells of `rows` are in `ink`. */
const count = (rows: readonly string[], ink: string) =>
  rows.reduce((n, row) => n + [...row].filter((cell) => cell === ink).length, 0);

/** The ink a mark is drawn in. */
const inkOf = (art: readonly string[]) => art.join("").replaceAll(".", "")[0]!;

describe("the marks a landing raises over its cheer", () => {
  const added = inkOf(DIFF_MARKS!.added.art);
  const removed = inkOf(DIFF_MARKS!.removed.art);

  it("leave a landing that changed no lines as it was, and name scenes of their own", () => {
    expect(marked(bare, none)).toBe(bare);
    expect(marked(bare, both).name).not.toBe(bare.name);
    expect(marked(bare, { added: true, removed: false }).name).not.toBe(marked(bare, both).name);
  });

  it("rise a + for lines added and a − for lines removed, then are gone before the cheer starts again", () => {
    const plain = sceneOf(bare, "happy")!.hero;
    const cheer = sceneOf(marked(bare, both), "happy")!.hero;
    const rise = DIFF_MARKS!.rise;
    expect(rise.length).toBeLessThan(cheer.length);
    cheer.forEach((frame, i) => {
      if (i < rise.length) {
        expect(count(frame, added), `frame ${i}: the +`).toBeGreaterThan(count(plain[i]!, added));
        expect(count(frame, removed), `frame ${i}: the −`).toBeGreaterThan(
          count(plain[i]!, removed),
        );
      } else expect(frame, `frame ${i}`).toEqual(plain[i]);
    });
    const onlyAdded = sceneOf(marked(bare, { added: true, removed: false }), "happy")!.hero;
    expect(count(onlyAdded[0]!, removed)).toBe(count(plain[0]!, removed));
  });

  it("rise from the shoulder to near the top, inside the box at both sizes", () => {
    const cheer = sceneOf(marked(bare, both), "happy")!;
    const top = (rows: readonly string[]) =>
      rows.findIndex((row) => row.includes(added) || row.includes(removed));
    const heroes = cheer.hero.slice(0, DIFF_MARKS!.rise.length);
    expect(top(heroes.at(-1)!)).toBeLessThan(top(heroes[0]!));
    // Held to the box, not the body: the cheer's hop never throws them up and back.
    for (let i = 1; i < heroes.length; i++)
      expect(top(heroes[i]!), `hero frame ${i}`).toBeLessThanOrEqual(top(heroes[i - 1]!));
    for (const [i, frame] of heroes.entries())
      expect(pastDetail(frame), `hero frame ${i}`).toBe(
        pastDetail(sceneOf(bare, "happy")!.hero[i]!),
      );
    // The miniature draws every cell of both marks: none falls off its canvas.
    const plain = sceneOf(bare, "happy")!.mini;
    for (const [i, frame] of cheer.mini.slice(0, DIFF_MARKS!.rise.length).entries()) {
      expect(count(frame.rows, added) - count(plain[i]!.rows, added), `mini frame ${i}: +`).toBe(
        count(DIFF_MARKS!.added.mini!, added),
      );
      expect(
        count(frame.rows, removed) - count(plain[i]!.rows, removed),
        `mini frame ${i}: −`,
      ).toBe(count(DIFF_MARKS!.removed.mini!, removed));
    }
  });

  it("play only over the cheer, the flex included", () => {
    const look = marked(bare, both);
    for (const key of SCENES.keys())
      if (key !== "happy") expect(sceneOf(look, key)!.hero, key).toEqual(sceneOf(bare, key)!.hero);
    expect(CHEERS.has(FLEX)).toBe(true);
    const flex = sceneOf(marked(grown(bare, "arms", true), both), "happy")!.hero;
    expect(count(flex[0]!, added)).toBeGreaterThan(0);
  });
});
