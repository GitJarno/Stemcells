import * as NodeAssert from "node:assert/strict";
import { test } from "vite-plus/test";

import { cellAt, type Grid, isEmpty, sameGrid } from "../grid.ts";
import { BODY_HEIGHT } from "../canon.ts";
import { eyeDistance } from "../eye.ts";
import { gridEyes } from "../render.ts";
import {
  BODY_MID,
  BODY_WIDTH,
  cellToCanon,
  cloudAtRest,
  cloudCells,
  homeFit,
  type SceneCard,
} from "../scene.ts";
import { BACK } from "./back.ts";
import { BITS } from "./bits.ts";
import { MOMENT_CARDS, momentCard } from "./cards.ts";
import { budOf } from "./many.ts";
import { TYPING, typingFor } from "./line.ts";
import { NIGHT } from "./night.ts";
import { PAGES } from "./pages.ts";
import { WINDOW } from "./window.ts";
import { ZIP } from "./zipped.ts";
import { eyesLooking, squareOf } from "./stage.ts";

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
    NodeAssert.ok(card.still > 0 && card.still < card.end, `${id}: the still is inside`);
    NodeAssert.ok(card.eyes(card.still) > 0, `${id}: the still shows its eyes`);
    NodeAssert.ok(card.lines.length <= 1, id);
    const line = card.lines[0];
    if (line === undefined) continue;
    NodeAssert.ok(line.trim().split(/\s+/).length <= 8, `${id}: ${line}`);
    const say = card.beats.say!;
    NodeAssert.ok(
      say * 1000 + typingFor(line) + TYPING.hold <= card.end * 1000,
      `${id}: the line is typed and the cursor has rested before the moment ends`,
    );
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

test("clear shows each ask as a mark beside Aski, takes them away one by one, then is pleased", () => {
  const stage = STAGES[0]!,
    card = MOMENT_CARDS.clear({ n: 4 }),
    rest = cloudAtRest(stage),
    marks = (t: number) =>
      card.frame(t, stage).cells.filter((c, k) => c.ch === "!" && rest.cells[k]!.ch !== "!").length;
  NodeAssert.equal(marks(0.5), 4);
  NodeAssert.equal(marks(card.beats.gone!), 0);
  NodeAssert.equal(card.mood?.(card.beats.gone! + 0.3), "pleased");
  NodeAssert.deepEqual(card.lines, [], "the list of what needs the person says it");
  NodeAssert.equal(
    MOMENT_CARDS.clear({ n: 40 })
      .frame(0.5, stage)
      .cells.filter((c) => c.ch === "!").length,
    9,
  );
});

test("many buds one Cell per title, named by its longest word, and leaves Aski as it was", () => {
  const stage = STAGES[0]!,
    titles = ["Fix the login page", "Add tests", "Write docs", "Tune the api", "Polish ui"],
    card = MOMENT_CARDS.many({ titles }),
    seen = card
      .frame(card.still, stage)
      .cells.map((c) => c.ch)
      .join("");
  for (const word of ["(login)", "(tests)", "(write)", "(tune)", "(polish)"])
    NodeAssert.ok(seen.includes(word), `buds ${word}`);
  const body = new Set(cloudCells(stage)),
    rest = cloudAtRest(stage),
    frame = card.frame(card.still, stage);
  for (const k of body) NodeAssert.deepEqual(frame.cells[k], rest.cells[k], "Aski is untouched");
});

test("a bud holds the longest word that fits it whole", () => {
  NodeAssert.equal(budOf("Spell banana backwards"), "(banana)");
  NodeAssert.equal(budOf("Describe a teapot"), "(describe)");
  NodeAssert.equal(budOf("Internationalization"), "(internat)");
  NodeAssert.equal(budOf("Do it"), "(cell)");
});

test("many's buds settle no higher or lower than Aski, so the band never cuts one off", () => {
  const card = MOMENT_CARDS.many({
    titles: ["a1", "b22", "c333", "d4444", "e55555", "f666666", "g7"],
  });
  for (const stage of STAGES) {
    const sq = squareOf(stage),
      body = new Set(cloudCells(stage)),
      frame = card.frame(card.still, stage);
    for (const [k, cell] of frame.cells.entries()) {
      if (body.has(k) || isEmpty(cell)) continue;
      const row = Math.floor(k / stage.cols);
      NodeAssert.ok(row >= sq.top && row <= sq.bottom, `row ${row} on ${stage.cols}×${stage.rows}`);
    }
  }
});

test("the news: asleep, then one eye goes to the line, stands aside while it types, and comes home", () => {
  const stage = STAGES[0]!,
    line = { from: [150, 10] as const, to: [180, 10] as const },
    card = MOMENT_CARDS.news({ n: 3, line });
  NodeAssert.equal(card.mood?.(0.2), "asleep");
  NodeAssert.equal(card.lines[0], "3 landed while you were out.");
  const there = card.eyesAt?.(card.beats.there! - 0.001, stage);
  NodeAssert.ok(there && there.at.length === 2 && Math.abs(there.at[1]![0] - 150) < 0.5);
  NodeAssert.equal(
    card.eyesAt?.(card.beats.say! + 0.5, stage)?.at.length,
    1,
    "its eye is the cursor",
  );
  const leaving = card.eyesAt?.(card.beats.typed! + 0.01, stage);
  NodeAssert.ok(
    leaving && Math.abs(leaving.at[1]![0] - 180) < 1,
    "it comes home from the line's end",
  );
  NodeAssert.equal(card.eyesAt?.(card.still, stage) ?? null, null, "both home on the still");
});

test("a haul says its whole hours", () => {
  NodeAssert.equal(
    MOMENT_CARDS.haul({ hours: 1 }).lines[0],
    "An hour of work. No questions asked.",
  );
  NodeAssert.equal(
    MOMENT_CARDS.haul({ hours: 3 }).lines[0],
    "3 hours of work. No questions asked.",
  );
});

test("zipped lays a zipper beside Aski, longer for a bigger change, and its pull closes it into Aski", () => {
  const stage = STAGES[0]!,
    sq = squareOf(stage),
    mid = Math.round(sq.middle);
  const row = (g: Grid, j: number): string =>
    Array.from({ length: stage.cols }, (_, i) => cellAt(g, i, j).ch).join("");
  const big = MOMENT_CARDS.zipped({ base: "main", lines: 2000 }),
    small = MOMENT_CARDS.zipped({ base: "main", lines: 10 });
  const open = (card: SceneCard): number =>
    row(card.frame(ZIP.from + 0.05, stage), mid - 1).replaceAll(" ", "").length +
    row(card.frame(ZIP.from + 0.05, stage), mid - 2).replaceAll(" ", "").length;
  NodeAssert.ok(open(big) > open(small), "a bigger change, a longer zipper");
  const closed = big.frame(big.still, stage);
  NodeAssert.ok(row(closed, mid).includes("=>"), "closed up to its pull");
  NodeAssert.ok(!row(closed, mid - 2).includes("-"), "no rail left open");
  NodeAssert.equal(big.lines[0], "Zipped into main.");
  NodeAssert.equal(big.mood?.(big.still), "pleased");
});

test("things: a letter for each new file leaves Aski and lands as a file, at most nine", () => {
  const stage = STAGES[0]!,
    files = (card: SceneCard): number =>
      card
        .frame(card.still, stage)
        .cells.map((c) => c.ch)
        .join("")
        .split("[=]").length - 1;
  NodeAssert.equal(files(MOMENT_CARDS.things({ n: 3 })), 3);
  NodeAssert.equal(files(MOMENT_CARDS.things({ n: 40 })), 9);
  NodeAssert.equal(MOMENT_CARDS.things({ n: 1 }).lines[0], "One new file. Words became things.");
  NodeAssert.equal(MOMENT_CARDS.things({ n: 4 }).lines[0], "4 new files. Words became things.");
});

test("the window's blind goes up and the Cells that waited go on out", () => {
  const stage = STAGES[0]!,
    card = MOMENT_CARDS.window({ n: 2 }),
    count = (t: number, ch: string): number =>
      card.frame(t, stage).cells.filter((c) => c.ch === ch && c.ink > 0).length;
  NodeAssert.ok(count(0.4, "#") > 0, "shut at first");
  NodeAssert.equal(count(WINDOW.open, "#"), 0, "open");
  NodeAssert.equal(count(WINDOW.open, "o"), 2, "two Cells waited behind it");
  NodeAssert.equal(count(card.beats.gone!, "o"), 0, "and went on");
  NodeAssert.equal(card.lines[0], "Window's open. 2 Cells carried on.");
  NodeAssert.equal(MOMENT_CARDS.window({ n: 1 }).lines[0], "Window's open. A Cell carried on.");
});

test("pages fold a tall stack down to three, and the thread to Aski stays whole", () => {
  NodeAssert.ok(
    MOMENT_CARDS.pages()
      .frame(PAGES.fold, STAGES[0]!)
      .cells.filter((c) => c.ch === "=").length >=
      5 * 8,
    "a tall stack at first",
  );
  for (const stage of STAGES) {
    const card = MOMENT_CARDS.pages(),
      rows = (t: number): number[] => {
        const g = card.frame(t, stage);
        return Array.from({ length: stage.rows }, (_, j) => j).filter((j) =>
          Array.from({ length: stage.cols }, (_, i) => cellAt(g, i, j).ch).includes("="),
        );
      },
      thread = (t: number): number =>
        card.frame(t, stage).cells.filter((c) => c.ch === "~" && c.ink > 0).length;
    NodeAssert.ok(rows(PAGES.fold).length >= rows(PAGES.folded).length, "never more once folded");
    NodeAssert.ok(rows(PAGES.folded).length <= 3, "three at most once folded");
    NodeAssert.equal(thread(PAGES.fold), thread(PAGES.folded), "the same thread");
  }
});
