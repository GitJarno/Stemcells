import * as NodeAssert from "node:assert/strict";
import { test } from "vite-plus/test";
import { isEmpty, sameGrid } from "./grid.ts";
import { eyesLooking } from "./moments/stage.ts";
import { cloudAtRest } from "./scene.ts";
import { squashAt, theThrow, theWait, throwAt, thrown, waitLook } from "./scenes/the-throw.ts";

const STAGE = { cols: 96, rows: 28 };
const WAIT = { lookIn: 0.94, turn: 1.6 };
const THROW = { stagger: 0.09, travel: 0.481, flick: 0.12 };

test("while Aski waits its body is still: its eyes look down at the words, then ride their orbit", () => {
  const card = theWait(WAIT);
  for (const t of [0, 0.5, 2, 7.3])
    NodeAssert.deepEqual(card.frame(t, STAGE), cloudAtRest(STAGE), `still at ${t}`);
  const [, down] = waitLook(WAIT.lookIn - 0.1, WAIT);
  NodeAssert.ok(down > 0, "looking down as the words come");
  const half = waitLook(WAIT.lookIn + WAIT.turn / 2, WAIT);
  NodeAssert.ok(half[1] < 0, "half a turn on, looking up");
  const round = waitLook(WAIT.lookIn + WAIT.turn, WAIT);
  NodeAssert.ok(Math.abs(round[0]) < 1e-9 && round[1] > 0, "a turn on, down again");
  NodeAssert.deepEqual(
    waitLook(WAIT.lookIn + 5, { ...WAIT, turn: 0 }),
    waitLook(WAIT.lookIn - 0.1, WAIT),
    "with no orbit known, the eyes stay down",
  );
  NodeAssert.deepEqual(
    card.eyesAt?.(WAIT.lookIn, STAGE),
    eyesLooking(STAGE, waitLook(WAIT.lookIn, WAIT)),
  );
});

test("Aski pulses once a stream, spawn-stagger apart, and goes ^ ^ once the last is away", () => {
  const card = theThrow(3, [], THROW),
    rest = cloudAtRest(STAGE);
  NodeAssert.deepEqual(
    card.frame(0, STAGE),
    rest,
    "the first stream leaves at once, the pulse with it",
  );
  for (let k = 0; k < 3; k++) {
    const peak = k * THROW.stagger + THROW.flick / 2;
    NodeAssert.ok(squashAt(peak, 3, THROW) > 0.9, `pulse ${k} at its height`);
    const g = card.frame(peak, STAGE);
    NodeAssert.ok(!sameGrid(g, rest), `squashed at pulse ${k}`);
    const top = (grid: typeof g) =>
      Math.min(...grid.cells.flatMap((c, i) => (isEmpty(c) ? [] : [Math.floor(i / STAGE.cols)])));
    NodeAssert.ok(top(g) > top(rest), "a row lower at the top, its feet where they were");
  }
  const done = thrown(3, THROW);
  NodeAssert.deepEqual(card.frame(done, STAGE), rest, "sprung back");
  NodeAssert.equal(card.mood?.(done - 0.01), undefined);
  NodeAssert.equal(card.mood?.(done), "pleased");
});

test("Aski's eyes follow each stream to its pane, then come home", () => {
  const looks = [
    [0, 5],
    [5, 0],
  ] as const;
  const card = theThrow(2, looks, THROW);
  NodeAssert.deepEqual(card.eyesAt?.(0.01, STAGE), eyesLooking(STAGE, looks[0]));
  NodeAssert.deepEqual(card.eyesAt?.(THROW.stagger + 0.01, STAGE), eyesLooking(STAGE, looks[1]));
  NodeAssert.equal(card.eyesAt?.(thrown(2, THROW), STAGE), null);
});

test("four streams fly at once: Aski throws a fifth only as the first lands", () => {
  NodeAssert.deepEqual(
    [0, 1, 2, 3].map((k) => throwAt(k, THROW)),
    [0, 1, 2, 3].map((k) => k * THROW.stagger),
  );
  NodeAssert.equal(throwAt(4, THROW), THROW.travel);
  NodeAssert.equal(throwAt(5, THROW), THROW.stagger + THROW.travel);
  NodeAssert.equal(thrown(6, THROW), THROW.stagger + THROW.travel + THROW.flick);
  const looks = [0, 1, 2, 3, 4].map((k) => [k, 0] as const),
    card = theThrow(5, looks, THROW);
  NodeAssert.deepEqual(card.eyesAt?.(THROW.travel - 0.01, STAGE), eyesLooking(STAGE, looks[3]!));
  NodeAssert.deepEqual(card.eyesAt?.(THROW.travel, STAGE), eyesLooking(STAGE, looks[4]!));
});
