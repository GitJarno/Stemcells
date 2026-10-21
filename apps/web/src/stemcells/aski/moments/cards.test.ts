import * as NodeAssert from "node:assert/strict";
import { test } from "vite-plus/test";

import { cellAt, isEmpty, sameGrid } from "../grid.ts";
import { BODY_HEIGHT } from "../canon.ts";
import { eyeDistance } from "../eye.ts";
import { gridEyes } from "../render.ts";
import { BODY_MID, BODY_WIDTH, cellToCanon, cloudAtRest, cloudCells, homeFit } from "../scene.ts";
import { BACK } from "./back.ts";
import { BITS } from "./bits.ts";
import { MOMENT_CARDS, momentCard } from "./cards.ts";
import { TYPING, typingFor } from "./line.ts";
import { NIGHT } from "./night.ts";
import { eyesLooking } from "./stage.ts";

const STAGES = [
  { cols: 180, rows: 21 },
  { cols: 96, rows: 28 },
  { cols: 60, rows: 12 },
];

test("every moment opens and ends on Aski at rest, so the figure fades out and back without a seam", () => {
  for (const [id, make] of Object.entries(MOMENT_CARDS)) {
    const card = make();
    for (const stage of STAGES) {
      const rest = cloudAtRest(stage);
      NodeAssert.deepEqual(card.frame(0, stage), rest, `${id} opens at rest`);
      NodeAssert.deepEqual(card.frame(card.end, stage), rest, `${id} ends at rest`);
      NodeAssert.equal(card.eyesAt?.(card.end, stage) ?? null, null, `${id}'s eyes end at home`);
    }
    NodeAssert.equal(card.eyes(0), 1, `${id} opens with its eyes open`);
    NodeAssert.equal(card.eyes(card.end), 1, `${id} ends with its eyes open`);
    NodeAssert.equal(card.mood?.(card.end), undefined, `${id} ends on the blocks`);
  }
});

test("a moment's frame depends on its time and stage alone", () => {
  for (const [id, make] of Object.entries(MOMENT_CARDS)) {
    const card = make(),
      stage = STAGES[0]!,
      times = [0.5, 1, 2, card.still, card.end - 0.5];
    const first = times.map((t) => card.frame(t, stage));
    card.frame(1.3, STAGES[2]!);
    for (const [n, t] of [...times.entries()].toReversed())
      NodeAssert.deepEqual(card.frame(t, stage), first[n], `${id} at ${t}`);
  }
});

test("each line fits its moment: eight words at most, typed and read before it ends, its still showing the eyes", () => {
  for (const [id, make] of Object.entries(MOMENT_CARDS)) {
    const card = make();
    NodeAssert.equal(card.lines.length, 1, id);
    const line = card.lines[0]!;
    NodeAssert.ok(line.trim().split(/\s+/).length <= 8, `${id}: ${line}`);
    const say = card.beats.say!;
    NodeAssert.ok(
      say * 1000 + typingFor(line) + TYPING.hold <= card.end * 1000,
      `${id}: the line is typed and the cursor has rested before the moment ends`,
    );
    NodeAssert.ok(card.still > 0 && card.still < card.end, `${id}: the still is inside`);
    NodeAssert.ok(card.eyes(card.still) > 0, `${id}: the still shows its eyes`);
  }
});

test("nothing a moment draws runs into its line, typed to the right of Aski's square", () => {
  for (const [id, make] of Object.entries(MOMENT_CARDS)) {
    const card = make();
    for (const stage of STAGES) {
      const fit = homeFit(stage);
      const right = (BODY_MID.x + Math.max(BODY_WIDTH, BODY_HEIGHT) / 2) * fit.kx + fit.cx;
      const middle = BODY_MID.y * fit.ky + fit.ground;
      for (let t = 0; t <= card.end; t += 0.1) {
        const g = card.frame(t, stage);
        for (let j = Math.floor(middle - 2); j <= Math.ceil(middle + 2); j++)
          for (let i = Math.ceil(right); i < stage.cols; i++)
            NodeAssert.ok(
              isEmpty(cellAt(g, i, j)),
              `${id} at ${t.toFixed(1)} s draws at ${i},${j}`,
            );
      }
    }
  }
});

test("the bits lay out every character seven bits print, and gather back into Aski", () => {
  const stage = STAGES[0]!,
    card = MOMENT_CARDS.bits(),
    laid = card.frame(BITS.laid + 0.5, stage);
  const shown = laid.cells.filter((c) => !isEmpty(c)).map((c) => c.ch);
  for (let code = 33; code < 127; code++)
    NodeAssert.ok(shown.includes(String.fromCharCode(code)), `shows ${String.fromCharCode(code)}`);
  NodeAssert.equal(shown.length, 94, "the table alone: the rest of Aski has gone into it");
  // The painter steps a cell aside under the eyes; none of the table may be one of them.
  const fit = homeFit(stage),
    eyes = gridEyes({ open: 1, fit, at: card.eyesAt?.(card.still, stage) ?? null });
  laid.cells.forEach((c, k) => {
    if (isEmpty(c)) return;
    const [x, y] = cellToCanon(fit, k % stage.cols, Math.floor(k / stage.cols));
    for (const eye of eyes)
      NodeAssert.ok(eyeDistance(x, y, eye) >= 0.35 / fit.ky, `${c.ch} hides behind an eye`);
  });
  NodeAssert.ok(
    !sameGrid(card.frame(BITS.back + 0.6, stage), cloudAtRest(stage)),
    "on their way back",
  );
  NodeAssert.deepEqual(card.frame(BITS.home, stage), cloudAtRest(stage));
});

test("back wears the crash's x x, flickers, and ends on the blocks", () => {
  const card = MOMENT_CARDS.back();
  NodeAssert.equal(card.mood?.(0.5), "crashed");
  const flicker = Array.from({ length: 5 }, (_, n) => card.mood?.(BACK.flicker + 0.08 + n * 0.16));
  NodeAssert.deepEqual(flicker, [undefined, "crashed", undefined, "crashed", undefined]);
  NodeAssert.equal(card.mood?.(BACK.up), undefined);
  NodeAssert.equal(card.mood?.(card.still), undefined, "the still is Aski back");
});

test("the night thins Aski, brings out three stars beside it, and lifts its eyes to them", () => {
  const stage = STAGES[0]!,
    card = MOMENT_CARDS.night(),
    deep = card.frame(card.still, stage),
    rest = cloudAtRest(stage),
    body = new Set(cloudCells(stage));
  const faint = [...body].filter((k) => !sameCell(deep, rest, k)).length;
  NodeAssert.ok(
    faint > body.size * 0.3 && faint < body.size * 0.7,
    `about half faint: ${faint} of ${body.size}`,
  );
  const stars = deep.cells.filter((c, k) => !body.has(k) && !isEmpty(c)).map((c) => c.ch);
  NodeAssert.deepEqual(stars.sort(), ["*", "+", "+"].sort());
  NodeAssert.ok(card.eyes(card.still) < 1, "heavy-lidded");
  const up = card.eyesAt?.(NIGHT.stars + 0.8, stage);
  NodeAssert.ok(up, "its eyes have left home");
  NodeAssert.ok(up.at[0][1] < eyesLooking(stage, [0, 0]).at[0][1], "looking up");
});

test("a moment that doesn't exist has no card", () => {
  NodeAssert.equal(momentCard("record"), undefined);
  NodeAssert.equal(momentCard("toString"), undefined);
  NodeAssert.equal(momentCard("bits")?.id, "bits");
});

function sameCell(
  a: ReturnType<typeof cloudAtRest>,
  b: ReturnType<typeof cloudAtRest>,
  k: number,
): boolean {
  const i = k % a.cols,
    j = Math.floor(k / a.cols),
    x = cellAt(a, i, j),
    y = cellAt(b, i, j);
  return x.ch === y.ch && x.ink === y.ink;
}
