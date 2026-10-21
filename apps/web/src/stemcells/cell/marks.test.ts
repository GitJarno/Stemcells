import { describe, expect, it } from "vite-plus/test";

import { DIFF_MARKS } from "./kit.ts";
import { withMarks } from "./marks.ts";
import { DETAIL, grown, MARGIN, packLook, sceneOf } from "./scene.ts";
import { crop } from "./sprite.ts";

const both = { added: true, removed: true };
const none = { added: false, removed: false };
const cheer = sceneOf(packLook([]), "happy")!;
const flex = sceneOf(grown(packLook([]), "arms", true), "happy")!;

/** How many cells of `rows` are in `ink`. */
const count = (rows: readonly string[], ink: string) =>
  rows.reduce((n, row) => n + [...row].filter((cell) => cell === ink).length, 0);

/** The ink a mark is drawn in. */
const inkOf = (art: readonly string[]) => art.join("").replaceAll(".", "")[0]!;

describe("the marks a landing raises over its cheer", () => {
  const { rise, added, removed } = DIFF_MARKS!;
  const plus = inkOf(added.art);
  const minus = inkOf(removed.art);
  const top = (rows: readonly string[]) =>
    rows.findIndex((row) => row.includes(plus) || row.includes(minus));

  it("leave a landing that changed no lines as it was", () => {
    const frame = cheer.mini[0]!;
    expect(withMarks(frame, none, 0)).toBe(frame);
  });

  it("rise a + for lines added and a − for lines removed once, then are gone", () => {
    const frame = cheer.mini[0]!;
    for (let beat = 0; beat < rise.length; beat++) {
      const marked = withMarks(frame, both, beat);
      expect(count(marked.detail, plus), `beat ${beat}: the +`).toBeGreaterThan(
        count(frame.detail, plus),
      );
      expect(count(marked.detail, minus), `beat ${beat}: the −`).toBeGreaterThan(
        count(frame.detail, minus),
      );
    }
    expect(withMarks(frame, both, rise.length)).toBe(frame);
    const onlyAdded = withMarks(frame, { added: true, removed: false }, 0);
    expect(count(onlyAdded.detail, minus)).toBe(count(frame.detail, minus));
  });

  it("rise steadily from the box, whatever the cheer's frame does", () => {
    // The beat from the landing, not the cheer's frame, sets where they stand: a hop doesn't carry them.
    for (const [i, frame] of cheer.mini.entries()) {
      const tops = rise.map((_, beat) => top(withMarks(frame, both, beat).detail));
      expect(tops.at(-1), `cheer frame ${i}`).toBeLessThan(tops[0]!);
      for (let beat = 1; beat < tops.length; beat++)
        expect(tops[beat], `cheer frame ${i}, beat ${beat}`).toBeLessThanOrEqual(tops[beat - 1]!);
      expect(top(withMarks(frame, both, 2).detail)).toBe(
        top(withMarks(cheer.mini[0]!, both, 2).detail),
      );
    }
  });

  it("draw whole inside the box at both sizes, over the flex too", () => {
    for (const scene of [cheer, flex])
      for (const frame of scene.mini)
        for (let beat = 0; beat < rise.length; beat++) {
          const marked = withMarks(frame, both, beat);
          for (const [ink, mark] of [
            [plus, added],
            [minus, removed],
          ] as const) {
            expect(count(marked.detail, ink) - count(frame.detail, ink), `hero ${ink}`).toBe(
              count(mark.art, ink),
            );
            expect(count(marked.rows, ink) - count(frame.rows, ink), `mini ${ink}`).toBe(
              count(mark.mini, ink),
            );
          }
        }
  });

  it("stand in the margin's picture where they stand in the box's, at both sizes", () => {
    const marked = withMarks(cheer.mini[0]!, both, 0);
    const { width, height } = DETAIL;
    expect(crop(marked.drawn.detail, MARGIN.x * 2, MARGIN.y * 2, width, height)).toEqual(
      marked.detail,
    );
    const box = { width: marked.rows[0]!.length, height: marked.rows.length };
    expect(crop(marked.drawn.rows, MARGIN.x, MARGIN.y, box.width, box.height)).toEqual(marked.rows);
  });

  it("hold at the top for Reduce Motion", () => {
    const frame = cheer.mini[0]!;
    expect(withMarks(frame, both, undefined)).toEqual(withMarks(frame, both, rise.length - 1));
  });
});
