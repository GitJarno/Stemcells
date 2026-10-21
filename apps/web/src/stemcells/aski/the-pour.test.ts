import * as NodeAssert from "node:assert/strict";
import { test } from "vite-plus/test";
import { type Grid, isEmpty, sameGrid } from "./grid.ts";
import { cloudAtRest, cloudCells } from "./scene.ts";
import { POUR, POURED, pourLetters, thePour } from "./scenes/the-pour.ts";

const STAGE = { cols: 96, rows: 28 };
const MESSAGE = "Fix the login bug and add tests";

const filled = (g: Grid): number[] => g.cells.flatMap((cell, k) => (isEmpty(cell) ? [] : [k]));
/** The cells at full ink: the message's letters, over the dimmed cloud. */
const bright = (g: Grid): number[] => filled(g).filter((k) => g.cells[k]!.ink === 1);

test("the pour opens on Aski at rest and gathers the message's letters inside the dimmed cloud", () => {
  const card = thePour(MESSAGE),
    still = card.frame(card.still, STAGE),
    body = cloudCells(STAGE),
    poured = new Set(pourLetters(MESSAGE));
  NodeAssert.deepEqual(card.frame(0, STAGE), cloudAtRest(STAGE), "no letter is in sight yet");
  NodeAssert.deepEqual(filled(still), body, "nothing is left outside the cloud");
  const letters = bright(still);
  NodeAssert.ok(
    letters.length >= pourLetters(MESSAGE).length * 0.8,
    `most letters show apart: ${letters.length}`,
  );
  NodeAssert.ok(
    letters.every((k) => poured.has(still.cells[k]!.ch)),
    "and only the message's",
  );
  NodeAssert.ok(
    body.every((k) => letters.includes(k) || still.cells[k]!.ink === POUR.dim),
    "the rest of the cloud dimmed",
  );
});

test("the letters fly in from the left before they land", () => {
  const card = thePour(MESSAGE),
    body = new Set(cloudCells(STAGE)),
    g = card.frame(POUR.spread / 2, STAGE);
  const outside = filled(g).filter((k) => !body.has(k));
  NodeAssert.ok(outside.length > 0, "some are in flight");
  const left = Math.min(...[...body].map((k) => k % STAGE.cols));
  NodeAssert.ok(
    outside.every((k) => k % STAGE.cols < left + STAGE.cols / 4),
    "coming from Aski's left",
  );
});

test("while the Cells are planned the letters go round inside the cloud", () => {
  const card = thePour(MESSAGE),
    body = cloudCells(STAGE),
    poured = new Set(pourLetters(MESSAGE));
  for (const t of [POURED + 0.4, POURED + POUR.turn / 2, POURED + 7.3]) {
    const g = card.frame(t, STAGE);
    NodeAssert.deepEqual(filled(g), body, `within the cloud at ${t}`);
    NodeAssert.ok(
      bright(g).every((k) => poured.has(g.cells[k]!.ch)),
      `the message's letters at ${t}`,
    );
  }
  NodeAssert.ok(
    !sameGrid(card.frame(POURED + POUR.turn / 4, STAGE), card.frame(POURED, STAGE)),
    "and they move",
  );
  NodeAssert.deepEqual(card.frame(POURED + POUR.turn * 1e3, STAGE), card.frame(card.end, STAGE));
});

test("a message pours its printable letters, spaces dropped, thirty at most; none pours Aski's name", () => {
  NodeAssert.equal(pourLetters("ship it").join(""), "shipit");
  NodeAssert.equal(pourLetters("x".repeat(90)).length, POUR.most);
  NodeAssert.equal(pourLetters("café ☕").join(""), "caf");
  NodeAssert.equal(pourLetters("  ").join(""), "aski");
});
