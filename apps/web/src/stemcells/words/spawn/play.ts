/**
 * Plays the words' half of the spawn (`plan.ts`, and
 * `stemcells/docs/interaction.md`): the sent words' letters pour into Aski,
 * Aski divides into a copy a Cell (`aski/copies.ts`), each flying to its
 * Cell's box or, when the Cell landed off stage, its tab's chip, and over
 * a box the copy condenses through `. : + # @` until the Cell takes over
 * (`formAt`). It draws on a layer of its own over the page that no pointer
 * meets, and nothing waits on it: the composer takes typing all along, and
 * a Cell whose place doesn't show in time just stands.
 */
import { askiStill, copyHeight, copyTargetSoon, flyCopy } from "../../aski/copies";
import { spawnDone, spawnPlanned, spawnStart } from "../../aski/spawn";
import { cellBoxOf, formAt } from "../../cell/forming";
import { path, SIZE } from "../../cell/look";
import { reducedMotion, timed, timing } from "../../tokens/motion";
import {
  type Box,
  centreOf,
  GLYPHS,
  letterStagger,
  MOST_LETTERS,
  orbitAt,
  type Point,
  standing,
  streamStarts,
  trace,
} from "./plan";

/** A Cell the spawn forms: its thread, and its readout words ("Sol 6.1 · Harbor"). */
export interface SpawnCell {
  readonly threadId: string;
  readonly title: string;
}

export interface SpawnPlay {
  /** The Cells beside the draft's have started (those that did). */
  started(cells: readonly SpawnCell[]): void;
  /** Nothing was sent after all: the letters stop, and Aski goes. */
  off(): void;
}

/** A letter of the composer's text where it stands on screen. */
interface Letter {
  readonly char: string;
  readonly box: Box;
}

/** Aski's height in body lines, as aski.css's `--aski-size` has it. */
const ASKI_LINES = 6;
/** How far a letter's way bows, of its length: the pour swirls a little. */
const POUR_BEND = 0.2;
/** Keyframes a way is drawn with, and a turn of the orbit. */
const WAY_STEPS = 12;
const ORBIT_STEPS = 48;
/** How long a spawn waits for its Cells to start before it ends on its own, in ms, as Aski does. */
const GIVE_UP = 10_000;
/** How long a Cell's box may take to show once its thread is known, in ms: past it, the Cell stands. */
const BOX_WAIT = 3000;
/** Rows of glyphs over a Cell's box. */
const GLYPH_ROWS = 3;

/**
 * Plays a message that starts several Cells from the draft's composer
 * `editor`, Aski standing on `hero` (the draft's headline). Read the
 * letters before the composer changes; null under Reduce Motion, when
 * nothing plays.
 */
export function playSpawn(input: {
  readonly editor: HTMLElement;
  readonly hero: Box;
  /** The draft's own Cell, the first. */
  readonly first: SpawnCell;
  /** Every Cell's readout words, the first's first. */
  readonly titles: readonly string[];
}): SpawnPlay | null {
  if (reducedMotion()) return null;
  const start = performance.now();
  const layer = layerOver(input.editor.ownerDocument);
  const travel = timed("travel");
  const step = timing("formStep");
  const turn = timing("orbitTurn");
  const letters = lettersIn(input.editor);
  const apart = letterStagger(letters.length, timing("letterStagger"), timing("lettersSpan"));
  const ink = getComputedStyle(input.editor);
  const aski = standing(input.hero, askiHeight(ink));
  // Drawn while the letters pour: a copy is half Aski.
  const still = askiStill(copyHeight(aski.height), input.editor).catch(() => null);
  // Each letter pours into its place on the orbit, then rides it round Aski.
  const riding = letters.map((letter, i) => {
    const from = centreOf(letter.box);
    const leaves = i * apart;
    const arrives = leaves + travel.duration;
    const at = (turns: number) => {
      const p = orbitAt(aski, i, letters.length, turns);
      return `translate(${p.x - from.x}px, ${p.y - from.y}px)`;
    };
    const way = trace(from, orbitAt(aski, i, letters.length, arrives / turn), POUR_BEND, WAY_STEPS);
    const element = layer.append("sc-spawn-letter", letter.char, letter.box);
    element.style.font = ink.font;
    element.style.color = ink.color;
    element.animate(
      way.map((p) => ({ transform: `translate(${p.x - from.x}px, ${p.y - from.y}px)` })),
      { duration: travel.duration, easing: travel.easing, delay: leaves, fill: "backwards" },
    );
    element.animate(
      Array.from({ length: ORBIT_STEPS + 1 }, (_, k) => ({
        transform: at(arrives / turn + k / ORBIT_STEPS),
      })),
      { duration: turn, delay: arrives, iterations: Infinity },
    );
    return element;
  });
  // As the streams leave, the letters fade into Aski.
  const fadeLetters = () => {
    const fade = timed("fade");
    for (const element of riding)
      element
        .animate(
          { opacity: [1, 0] },
          { duration: fade.duration, easing: fade.easing, fill: "forwards" },
        )
        .finished.then(
          () => element.remove(),
          () => element.remove(),
        );
  };
  spawnStart(
    aski,
    input.titles.map((title) => ({ title })),
  );
  hold(input.first.threadId);
  // The letters go round Aski once, at least, before any stream leaves.
  const poured = start + Math.max(0, letters.length - 1) * apart + travel.duration + turn;
  let over = false;

  const out = async (cells: readonly SpawnCell[]) => {
    const [targets, figure] = await Promise.all([
      Promise.all(cells.map((cell) => copyTargetSoon(cell.threadId))),
      still,
    ]);
    await until(poured);
    if (over) return;
    const origin = centreOf(aski);
    const shown = figure === null ? [] : cells.filter((_, i) => targets[i] !== null);
    const into = (cell: SpawnCell) => targets[cells.indexOf(cell)]!;
    // A Cell its copy doesn't land on stands as its pane shows.
    for (const cell of cells)
      if (!shown.includes(cell) || into(cell).into === "chip") formAt(cell.threadId, 0);
    const starts = streamStarts(
      origin,
      shown.map((cell) => centreOf(into(cell).box)),
      { stagger: timing("spawnStagger"), travel: travel.duration },
    );
    // Aski pulses once a copy and looks where each goes, in the order they leave.
    const leaving = shown
      .map((cell, i) => ({ cell, at: starts[i]! }))
      .toSorted((a, b) => a.at - b.at);
    spawnPlanned(leaving.map(({ cell }) => ({ title: cell.title, to: into(cell).box })));
    fadeLetters();
    const now = performance.now();
    const landed = shown.map((cell, i) => {
      const flight = flyCopy(layer.root, figure!, aski, cell.threadId, starts[i]!, travel);
      if (into(cell).into === "chip") return flight;
      formAt(cell.threadId, now + starts[i]! + travel.duration + GLYPHS.length * step);
      return flight.then(() => glyphs(layer, cell, step));
    });
    await Promise.all(landed);
    end();
  };
  const end = () => {
    if (over) return;
    over = true;
    clearTimeout(giveUp);
    spawnDone();
    layer.remove();
  };
  const giveUp = setTimeout(end, GIVE_UP);
  return {
    started: (cells) => {
      for (const cell of cells) hold(cell.threadId);
      void out([input.first, ...cells]).catch(end);
    },
    off: end,
  };
}

/**
 * A Cell that starts alone from its draft: the glyphs play over its box,
 * from when it shows, then the Cell. Where Aski stood in the new chat
 * (`standing`, aski/AskiStanding.tsx), Aski is the Cell's copy: it flies to
 * the line whole first, and becomes the Cell.
 */
export function playForming(threadId: string, standing: Element | null = null): void {
  if (reducedMotion()) return;
  hold(threadId);
  const step = timing("formStep");
  const figure = standing?.querySelector(".aski-figure") ?? standing;
  const from = figure?.getBoundingClientRect();
  const still =
    figure && from && from.height > 0
      ? askiStill(from.height, figure).catch(() => null)
      : Promise.resolve(null);
  void Promise.all([boxOf(threadId), still]).then(async ([box, aski]) => {
    if (box === null) return formAt(threadId, 0);
    const layer = layerOver(document);
    if (aski !== null && from) {
      const travel = timed("travel");
      formAt(threadId, performance.now() + travel.duration + GLYPHS.length * step);
      await flyCopy(layer.root, aski, from, threadId, 0, travel, true);
    } else formAt(threadId, performance.now() + GLYPHS.length * step);
    await glyphs(layer, { threadId, title: "" }, step).finally(() => layer.remove());
  });
}

/** Aski's whole height, from the type tokens it is sized by. */
function askiHeight(style: CSSStyleDeclaration): number {
  const value = (token: string) => Number.parseFloat(style.getPropertyValue(token)) || 0;
  return value("--sc-body") * (value("--sc-natural-line") + value("--sc-leading")) * ASKI_LINES;
}

/** The Cell's box stays empty, for a stream, until its forming says otherwise (capped by `formAt`). */
const hold = (threadId: string) => formAt(threadId, performance.now() + BOX_WAIT);

/** The Cell's box once it shows, on the frames after; null if it hasn't within `BOX_WAIT`. */
function boxOf(threadId: string): Promise<DOMRect | null> {
  const give = performance.now() + BOX_WAIT;
  return new Promise((resolve) => {
    const look = () => {
      const box = cellBoxOf(threadId);
      if (box !== null || performance.now() > give) resolve(box);
      else requestAnimationFrame(look);
    };
    look();
  });
}

const until = (at: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, Math.max(0, at - performance.now())));

/** A layer over the page for the spawn to draw on, that no pointer meets and no reader reads. */
function layerOver(page: Document) {
  const root = page.createElement("div");
  root.className = "sc-spawn-layer";
  root.setAttribute("aria-hidden", "true");
  page.body.append(root);
  return {
    root,
    append(className: string, text: string, at: Point & Partial<Box>): HTMLElement {
      const element = page.createElement("span");
      element.className = className;
      element.textContent = text;
      element.style.left = `${at.x}px`;
      element.style.top = `${at.y}px`;
      if (at.height !== undefined) element.style.lineHeight = `${at.height}px`;
      root.append(element);
      return element;
    },
    remove: () => root.remove(),
  };
}
type Layer = ReturnType<typeof layerOver>;

let clips = 0;

/**
 * The stream condensed over the Cell's box: rows of a glyph cut to the bare
 * Cell's outline, `. : + # @`, one a `step`, then the Cell (`formAt`).
 */
async function glyphs(layer: Layer, cell: SpawnCell, step: number): Promise<void> {
  const box = cellBoxOf(cell.threadId);
  if (box === null) return;
  const page = layer.root.ownerDocument;
  const svg = page.createElementNS("http://www.w3.org/2000/svg", "svg");
  const id = `sc-spawn-clip-${++clips}`;
  const size = SIZE.height / GLYPH_ROWS;
  const columns = Math.ceil(SIZE.width / (size * 0.6));
  svg.setAttribute("class", "sc-spawn-glyphs");
  svg.setAttribute("viewBox", `0 0 ${SIZE.width} ${SIZE.height}`);
  svg.setAttribute("preserveAspectRatio", "xMidYMax meet");
  svg.style.left = `${box.x}px`;
  svg.style.top = `${box.y}px`;
  svg.style.width = `${box.width}px`;
  svg.style.height = `${box.height}px`;
  svg.innerHTML =
    `<clipPath id="${id}"><path d="${path("awake")}"/></clipPath>` +
    `<g clip-path="url(#${id})" font-size="${size}">` +
    Array.from({ length: GLYPH_ROWS }, (_, row) => `<text y="${(row + 0.85) * size}"></text>`).join(
      "",
    ) +
    "</g>";
  layer.root.append(svg);
  const rows = [...svg.querySelectorAll("text")];
  for (const glyph of GLYPHS) {
    for (const row of rows) row.textContent = glyph.repeat(columns);
    await until(performance.now() + step);
  }
  svg.remove();
}

/** The composer's letters where they stand, the most that leave, spaces left out. */
function lettersIn(editor: HTMLElement): Letter[] {
  const letters: Letter[] = [];
  const page = editor.ownerDocument;
  const walk = page.createTreeWalker(editor, NodeFilter.SHOW_TEXT);
  const range = page.createRange();
  for (let node = walk.nextNode(); node && letters.length < MOST_LETTERS; node = walk.nextNode()) {
    const text = node.textContent ?? "";
    for (let i = 0; i < text.length && letters.length < MOST_LETTERS; i++) {
      if (/\s/.test(text[i]!)) continue;
      range.setStart(node, i);
      range.setEnd(node, i + 1);
      const box = range.getBoundingClientRect();
      if (box.width > 0) letters.push({ char: text[i]!, box });
    }
  }
  return letters;
}
