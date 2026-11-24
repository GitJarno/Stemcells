// The second idea: shown, not told. A wall of an agent's prose turns into the
// four forms a person reads fastest, one after another: a chart, a diagram, a
// choice with a preview of each option, and one closing line. Its own characters
// travel to become each form, and a count says how many words are left to read.

import { drawBody, type Mark, Morph, type MorphLook, READ } from "./kit/bodies.ts";
import { span } from "./kit/form.ts";
import { AMBER, Glyphs, INK, type Rgb } from "./kit/glyphs.ts";
import { layerIn, scene, type SceneFrame } from "./kit/scenes.ts";

/** What an agent sends when nobody taught it otherwise. The three numbers that matter are in there. */
const REPORT = `
I started by looking into why the search endpoint has been feeling slow, since that was the main
concern you raised, and I want to walk through everything I found along the way so that the
reasoning behind the change is clear. First, I read through the handler in search/routes.ts and
the query builder it calls, to make sure I understood the current behaviour before changing
anything. The handler itself is fairly thin: it validates the query string, normalises the
filters, and hands off to buildSearchQuery, which assembles a single statement with a variable
number of joins depending on which filters are present. To get a baseline, I wrote a small
benchmark script that replays 2,000 recorded queries against a local copy of the staging data,
and I ran it three times to reduce noise. Before any changes, the p95 latency came out at roughly
840 ms, with the median much lower, which suggested that a subset of queries was dragging the
tail rather than everything being uniformly slow. I then turned on query logging and sorted by
duration, and it became fairly clear that the slow cases all share one shape: a text match on the
title and body columns, combined with a filter on workspace and a sort on updated_at. Looking at
the plan for one of these, the database was doing a sequential scan over the documents table and
then sorting the result in memory, which would explain why latency grows with the size of the
workspace. It is worth noting that the smaller workspaces were not affected much, so this may not
have shown up in earlier testing.

My first thought was that caching might be the least invasive option, so I tried that before
touching the schema. I added a small in-memory cache in front of the query, keyed on the
normalised query string plus the workspace id, with a time to live of sixty seconds and an upper
bound of 5,000 entries so that it cannot grow without limit. I also made sure that a write to a
document invalidates the entries for its workspace, because otherwise someone could edit a title
and then fail to find it for up to a minute, which seemed like the kind of thing that would
generate confusing bug reports. With the cache in place I reran the same benchmark, and the p95
dropped to about 310 ms. That is a real improvement, but I think it is somewhat misleading,
because the benchmark replays recorded traffic and therefore contains a lot of repeated queries.
The hit rate was around 64 percent, and every miss still paid the full cost of the scan. In other
words, the cache hides the slow query rather than fixing it, and the first person to search for
something new in a large workspace would still wait just as long as before. I considered raising
the time to live, but that makes the staleness problem worse, and it felt like tuning around the
underlying issue rather than addressing it.

So I went back to the query itself. The more durable fix seemed to be an index that matches the
shape of the slow queries. I added a migration that creates a full-text index over title and
body, and a second, composite index on workspace_id and updated_at, so that the filter and the
sort can both be served without a separate sort step. I was initially unsure whether the planner
would actually pick these up, since the query builder wraps the text match in a function call, so
I adjusted buildSearchQuery to use the indexed expression directly and confirmed from the plan
output that the sequential scan is gone. Creating the index on the staging copy took about four
minutes, and I used the concurrent option so that it should not block writes while it builds,
although that is worth double checking against production volumes. After that, on a cache miss,
the benchmark reported a p95 of approximately 120 ms, and with the cache enabled it was only
slightly lower, which suggests that the index is doing most of the work and the cache is now
more of a safety margin than a necessity.

On the testing side, I ran the full suite after each step. All 212 tests pass, including the 9
new ones I added: four for cache invalidation on write, three for the new query shape, and two
that check ordering when several documents share the same timestamp, since I noticed that the old
in-memory sort and the index could in principle disagree there. I also ran the linter and the
type checker, and both are clean. I did not change the response format, so clients should not
need any updates, and I left the old code path in place for now rather than deleting it.

That brings me to the open question, which I do not think I should decide on my own. The change
is ready, but there are two reasonable ways to roll it out. One option is to ship it directly, on
the grounds that the tests pass and the benchmark is unambiguous. The other is to put the new
query path behind a feature flag, enable it for a small share of workspaces first, and watch the
latency and error dashboards for a day before turning it on for everyone. The flag adds a little
code and a follow-up task to remove it later, but it would let us back out instantly if the index
behaves differently under production load than it did on the staging copy, which I cannot fully
rule out from here. My own inclination is toward the flag, mostly because the migration touches
the largest table we have, but I can see the argument for keeping things simple. Let me know
which you would prefer, and whether you would like me to also remove the cache now that the index
carries most of the improvement, or leave it in as it is. I am also happy to write up the
benchmark method in more detail if that would be useful, or to split the migration and the query
change into two separate pull requests so that they can be reviewed independently.
`
  .trim()
  .split(/\n\s*\n/)
  .map((paragraph) => paragraph.replace(/\s+/g, " "));

const BARS = [
  ["before", 840],
  ["cache", 310],
  ["index", 120],
] as const;
const STEPS = ["request", "cache", "index", "result"] as const;
const OPTIONS = [
  ["Behind a flag", "▁▁▁▂▂▂▃▃▃▄▄▄▅▅▅▆▆▆▇▇▇"],
  ["Ship it now", "▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇"],
] as const;
const QUESTION = ["Ship the index now,", "or behind a flag?"] as const;
const DONE = ["Done: search is 7x faster.", "Tests pass."] as const;
const LEFT = "Left: nothing.";

type Ink = readonly [Rgb, number];
const FULL: Ink = [INK, 1];
const DIM: Ink = [INK, 0.68];
const FAINT: Ink = [INK, 0.42];
const RULE: Ink = [INK, 0.3];
const ASKS: Ink = [AMBER, 1];
/** The wall's ink: about half, so every form it becomes is brighter than it was. */
const WALL = 0.5;

/** A cell is half as wide as it is tall. */
const W = READ / 2;

/** When each form is reached along the scene: a move from..to, then a rest as long, to read it. */
const MOVES = [
  [0.08, 0.28],
  [0.38, 0.5],
  [0.6, 0.71],
  [0.82, 0.93],
] as const;
const FORMS = ["chart", "diagram", "choice", "close"] as const;

/** The words a person reads in `text`: runs with a letter or a digit in them. */
const wordsIn = (text: string): number =>
  text.split(/\s+/).filter((run) => /[A-Za-z0-9]/.test(run)).length;

/** `text` broken at its spaces into lines of at most `cols` characters. */
function wrap(text: string, cols: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(" ")) {
    if (line !== "" && line.length + 1 + word.length > cols) {
      lines.push(line);
      line = word;
    } else line = line === "" ? word : `${line} ${word}`;
  }
  lines.push(line);
  return lines;
}

/** A word in a form: what it says, and which of the form's marks spell it. */
interface Word {
  readonly key: string;
  readonly at: readonly number[];
}

/** A box, CSS pixels. */
interface Box {
  readonly x: number;
  readonly y: number;
  readonly wide: number;
  readonly tall: number;
}
const inset = ({ x, y, wide, tall }: Box, dx: number, dy: number): Box => ({
  x: x + dx,
  y: y + dy,
  wide: wide - dx * 2,
  tall: tall - dy * 2,
});
/** Characters are placed by their middles: the box the middles of a box's cells stand in. */
const middles = (box: Box): Box => inset(box, W / 2, READ / 2);

/** The wall or a form, where it stands. */
interface Form {
  readonly marks: readonly Mark[];
  readonly words: readonly Word[];
  /** How many words a person reads on it. */
  readonly count: number;
  readonly whole: Box;
  /** Its solid parts, in order: the wall's bands, the chart's bars, the flow's steps, the closing line. */
  readonly parts: readonly Box[];
}

/** A drawing on the grid: runs of characters from a column and a row, each in its own ink. */
class Sheet {
  cols = 0;
  rows = 0;
  count = 0;
  readonly marks: Mark[] = [];
  readonly words: Word[] = [];
  readonly parts: Box[] = [];

  /** `text` from the cell at (col, row), its characters `h` tall. */
  put(col: number, row: number, text: string, ink: Ink = FULL, h = READ): this {
    const at = [...text].map((ch, i) => {
      if (ch === " ") return -1;
      this.marks.push({
        x: col * W + ((i + 0.5) * h) / 2,
        y: row * READ + h / 2,
        ch,
        h,
        rgb: ink[0],
        a: ink[1],
      });
      return this.marks.length - 1;
    });
    for (const word of text.matchAll(/[A-Za-z0-9]+/g))
      this.words.push({
        key: word[0].toLowerCase(),
        at: at.slice(word.index, word.index + word[0].length),
      });
    this.cols = Math.max(this.cols, col + (text.length * h) / READ);
    this.rows = Math.max(this.rows, row + h / READ);
    this.count += wordsIn(text);
    return this;
  }

  box(col: number, row: number, wide: number, tall: number, ink: Ink): this {
    this.put(col, row, `┌${"─".repeat(wide - 2)}┐`, ink);
    for (let j = 1; j < tall - 1; j++)
      this.put(col, row + j, "│", ink).put(col + wide - 1, row + j, "│", ink);
    return this.put(col, row + tall - 1, `└${"─".repeat(wide - 2)}┘`, ink);
  }

  /** Names the cells from (col, row) as one of the sheet's solid parts. */
  part(col: number, row: number, wide: number, tall: number): this {
    this.parts.push({ x: col * W, y: row * READ, wide: wide * W, tall: tall * READ });
    return this;
  }

  /** The sheet standing with its top left cell at (x, y). */
  at(x: number, y: number): Form {
    return {
      marks: this.marks.map((mark) => ({ ...mark, x: mark.x + x, y: mark.y + y })),
      words: this.words,
      count: this.count,
      whole: { x, y, wide: this.cols * W, tall: this.rows * READ },
      parts: this.parts.map((part) => ({ ...part, x: part.x + x, y: part.y + y })),
    };
  }
}

/** The wall: the report wrapped to `cols` and cut to `rows`, in as many bands as the chart has bars. */
function report(cols: number, rows: number): Sheet {
  const sheet = new Sheet();
  const lines = REPORT.flatMap((paragraph) => wrap(paragraph, cols)).slice(0, Math.max(0, rows));
  lines.forEach((line, row) => sheet.put(0, row, line, [INK, WALL]));
  BARS.forEach((_, n) => {
    const top = Math.round((n * lines.length) / BARS.length);
    sheet.part(0, top, cols, Math.round(((n + 1) * lines.length) / BARS.length) - top);
  });
  return sheet;
}

/** Numbers to compare: three bars, the longest `longest` cells, each two rows thick. */
function chart(longest: number, gap: number): Sheet {
  const sheet = new Sheet().put(0, 0, "Search, p95 (ms)");
  const from = 6 + gap;
  BARS.forEach(([label, ms], n) => {
    const row = 2 + n * 3,
      long = Math.round((ms / BARS[0][1]) * longest);
    sheet
      .put(from, row, "▄".repeat(long))
      .put(0, row + 1, label, DIM)
      .put(from, row + 1, "█".repeat(long))
      .put(from + long + gap, row + 1, String(ms))
      .put(from, row + 2, "▀".repeat(long))
      .part(from, row, long, 3);
  });
  return sheet;
}

/** A step's box, in cells, and the cells an arrow takes between two. */
const STEP = 13,
  ARROW = 8;

/** A flow: the request's way to its result, left to right, or top to bottom with arrows `drop` rows long. */
function flow(drop: number): Sheet {
  const sheet = new Sheet();
  STEPS.forEach((step, n) => {
    const col = drop > 0 ? 0 : n * (STEP + ARROW),
      row = n * (drop > 0 ? 3 + drop : 0);
    if (n > 0 && drop > 0) {
      for (let j = drop; j > 1; j--) sheet.put(6, row - j, "│", DIM);
      sheet.put(6, row - 1, "↓", DIM);
      if (step === "index") sheet.put(8, row - drop, "miss", DIM);
    } else if (n > 0) {
      sheet.put(col - ARROW + 1, 1, "─────→", DIM);
      if (step === "index") sheet.put(col - ARROW + 2, 0, "miss", DIM);
    }
    sheet
      .box(col, row, STEP, 3, FAINT)
      .put(col + Math.floor((STEP - step.length) / 2), row + 1, step)
      .part(col, row, STEP, 3);
  });
  return sheet;
}

const PEEK = OPTIONS[0][1].length;

/** A choice: who asks, one question, and each option with a preview. The recommended one is the full one. */
function choice(stacked: boolean, pad: number): Sheet {
  const sheet = new Sheet();
  const option = PEEK + 4,
    tall = stacked ? 4 : 5,
    inner = stacked ? option : option * 2 + 2;
  const question = stacked ? QUESTION : [QUESTION.join(" ")];
  sheet.put(3, 1 + pad, "Otter asks", ASKS);
  question.forEach((line, n) => sheet.put(3, 3 + pad + n, line));
  const top = 4 + pad + question.length;
  OPTIONS.forEach(([label, peek], n) => {
    const col = 3 + (stacked ? 0 : n * (option + 2)),
      row = top + (stacked ? n * tall : 0),
      ink = n === 0 ? FULL : FAINT;
    sheet
      .box(col, row, option, tall, n === 0 ? FULL : RULE)
      .put(col + 2, row + 1, `${n + 1} ${label}`, ink)
      .put(col + 2, row + tall - 2, peek, ink);
  });
  return sheet.box(0, 0, inner + 6, top + (stacked ? tall * 2 : tall) + pad + 1, RULE);
}

/** Where it stands: what is done, `h` tall, and under it what is left. */
function closing(done: readonly string[], h: number): Sheet {
  const sheet = new Sheet();
  const per = h / READ,
    wide = Math.max(...done.map((line) => line.length)) * per;
  done.forEach((line, n) => sheet.put((wide - line.length * per) / 2, n * per, line, FULL, h));
  return sheet
    .part(0, 0, wide, done.length * per)
    .put((wide - LEFT.length) / 2, done.length * per + 1, LEFT, DIM);
}

/**
 * The kit's turn on a straight path, all at once. Its Morph pairs two bodies along a curve of its
 * own, which runs left to right along a row: so a row turns into a row in order, and two bodies
 * that stand alike pair each character with its twin. Every pairing below is one of those.
 */
const STRAIGHT: MorphLook = { stagger: 0, lift: 0 };

/** `v` in a span `long` from `a`, carried into the span `to` from `b`: squashed to fit, never stretched. */
const squash = (v: number, a: number, long: number, b: number, to: number): number =>
  b + to / 2 + (v - a - long / 2) * Math.min(1, to / Math.max(1, long));
const squashed = (mark: Mark, a: Box, b: Box): { x: number; y: number } => ({
  x: squash(mark.x, a.x, a.wide, b.x, b.wide),
  y: squash(mark.y, a.y, a.tall, b.y, b.tall),
});

const within = ({ x, y }: Mark, box: Box): boolean =>
  x >= box.x && x <= box.x + box.wide && y >= box.y && y <= box.y + box.tall;

/** The marks of `marks` in `box`, taken out of it, a row at a time. */
function rowsIn(marks: Set<Mark>, box: Box): Mark[][] {
  const rows = new Map<number, Mark[]>();
  for (const mark of marks) {
    if (!within(mark, box)) continue;
    marks.delete(mark);
    rows.set(mark.y, [...(rows.get(mark.y) ?? []), mark]);
  }
  return [...rows.values()];
}

const spot = (mark: Mark): string => `${mark.x},${mark.y}`;

interface TurnLook {
  /** Boxes of the first form whose characters squash into boxes of the second, fading as they go. */
  readonly folds?: readonly (readonly [Box, Box])[];
  /** The folds are bars: they keep their ink, land as tiles on the twin's cells, and the tiles fade. */
  readonly solid?: boolean;
  /** Boxes of the first form that the second's characters grow out of: a fold, backwards. */
  readonly grows?: readonly (readonly [Box, Box])[];
  /** A character in one of the second form's parts is made of the one standing there in the first. */
  readonly stays?: boolean;
  /** How much of the move has passed before the second form's own characters start to show, 0..1. */
  readonly wait?: number;
}
type Turn = (glyphs: Glyphs, u: number) => void;

/** How much of a move with tiles in it is travel; the rest is the tiles fading. */
const LAND = 0.6;

/**
 * `from` turning into `to` as one move. A word both say travels whole. The rest of `from` folds
 * into `to` and the rest of `to` grows out of `from`, box by box, as `look` pairs them; what no
 * box holds fades, or shows, where it stands.
 */
function turn(from: Form, to: Form, look: TurnLook = {}): Turn {
  const { folds = [], solid = false, grows = [], stays = false, wait = 0 } = look;
  const left = new Set(from.marks),
    goal = new Set(to.marks),
    spent = new Set<Word>();
  const whole: Morph[] = [],
    shows: Morph[] = [],
    goes: Morph[] = [],
    tiles: Mark[] = [];
  for (const word of to.words) {
    const twin = from.words.find((other) => other.key === word.key && !spent.has(other));
    if (twin === undefined) continue;
    spent.add(twin);
    const a = twin.at.map((n) => from.marks[n]!),
      b = word.at.map((n) => to.marks[n]!);
    for (const mark of a) left.delete(mark);
    for (const mark of b) goal.delete(mark);
    whole.push(new Morph(a, b, STRAIGHT));
  }
  for (const [a, b] of grows)
    for (const row of rowsIn(goal, b)) {
      const seed = row.map((mark) => ({ ...mark, ...squashed(mark, b, a), a: 0 }));
      shows.push(new Morph(seed, row, STRAIGHT));
    }
  const here = new Map(stays ? [...left].map((mark) => [spot(mark), mark]) : []);
  const inPart = (mark: Mark): boolean => to.parts.some((part) => within(mark, part));
  const rest = [...goal],
    seeds = rest.map((mark) => (inPart(mark) && here.get(spot(mark))) || { ...mark, ch: " " });
  for (const seed of seeds) left.delete(seed);
  if (rest.length > 0) shows.push(new Morph(seeds, rest, STRAIGHT));
  for (const [a, b] of folds)
    for (const row of rowsIn(left, a)) {
      const twin = row.map((mark) => ({ ...mark, ...squashed(mark, a, b), a: 0 }));
      if (!solid) {
        goes.push(new Morph(row, twin, STRAIGHT));
        continue;
      }
      // As many travellers as the longer of the two, so none shares a place and each keeps its whole ink.
      const tile = Array.from({ length: Math.round(b.wide / W) + 1 }, (_, n) => ({
        ...twin[0]!,
        x: b.x + n * W,
        a: 1,
      }));
      const count = Math.max(row.length, tile.length);
      const spread = (marks: readonly Mark[]): Mark[] =>
        Array.from({ length: count }, (_, k) => marks[Math.floor((k * marks.length) / count)]!);
      tiles.push(...tile);
      goes.push(new Morph(spread(row), spread(tile), STRAIGHT));
    }
  const last = [...left];
  if (last.length > 0)
    goes.push(
      new Morph(
        last,
        last.map((mark) => ({ ...mark, a: 0 })),
        STRAIGHT,
      ),
    );
  const land = solid ? LAND : 1;
  return (glyphs, u) => {
    if (u <= 0) return drawBody(glyphs, from.marks);
    if (u >= 1) return drawBody(glyphs, to.marks);
    if (u < land) for (const part of goes) part.draw(glyphs, u / land);
    else drawBody(glyphs, tiles, (1 - u) / (1 - land));
    for (const part of shows) part.draw(glyphs, span(u, wait, 1));
    for (const part of whole) part.draw(glyphs, u / land);
  };
}

interface Play {
  readonly turns: readonly Turn[];
  /** The words on screen: the wall's, then each form's. */
  readonly words: readonly number[];
  readonly x: number;
  readonly y: number;
}

/** The wall is a page, not a banner: it stops at this many columns and stands in the middle. */
const PAGE = 104;

/** Lays the wall and the four forms out in the art box, on its grid. */
function lay(f: SceneFrame): Play {
  const cols = Math.max(1, Math.min(PAGE, Math.floor(f.art.width / W))),
    rows = Math.max(1, Math.floor(f.art.height / READ));
  const spare = f.art.width - cols * W;
  const x = Math.round(f.art.x + (spare > W ? spare / 2 : 0)),
    y = Math.round(f.art.y);
  // A hand gets drawings of its own: shorter bars, the flow top to bottom, the options stacked, the
  // line in two. A short box gets them with less air.
  const narrow = f.form === "phone" || cols < 80,
    tight = rows < (narrow ? 20 : 15);
  // Under the count and a clear row, in the middle of the box.
  const centred = (sheet: Sheet): Form =>
    sheet.at(
      x + Math.floor((cols - sheet.cols) / 2) * W,
      y + Math.max(2, Math.floor((rows - sheet.rows) / 2)) * READ,
    );

  const longest = narrow ? Math.max(7, Math.min(28, Math.floor((cols - 11) / 7) * 7)) : 49;
  const done = narrow ? DONE : [DONE.join(" ")];
  const big =
    [32, 24, 20].find((h) => (Math.max(...done.map((line) => line.length)) * h) / 2 <= cols * W) ??
    READ;

  const wall = report(cols, rows - 2).at(x, y + 2 * READ),
    bars = centred(chart(longest, narrow ? 1 : 2)),
    steps = centred(flow(narrow ? (tight ? 1 : 2) : 0)),
    asks = centred(choice(narrow, tight ? 0 : 1)),
    close = centred(closing(done, big));
  const about = steps.parts[STEPS.indexOf("index")]!;
  const pairs = (a: Form, b: Form, into: (box: Box) => Box) =>
    b.parts.flatMap((part, n) => (a.parts[n] ? [[middles(a.parts[n]), into(part)] as const] : []));
  return {
    turns: [
      // A band of lines squashes into its bar and ends under it: a character is a cell, a bar two rows of ink.
      turn(wall, bars, {
        folds: pairs(wall, bars, (bar) => inset(bar, W / 2, READ)),
        stays: true,
        wait: 0.25,
      }),
      // A bar lands between its step's rules.
      turn(bars, steps, {
        folds: pairs(bars, steps, (step) => inset(step, W, READ / 2)),
        solid: true,
        wait: 0.3,
      }),
      // The card opens out of the rows of the step it asks about; the flow fades where it stands.
      turn(steps, asks, {
        grows: [[middles({ ...asks.whole, y: about.y, tall: about.tall }), middles(asks.whole)]],
      }),
      // The card closes onto the line.
      turn(asks, close, {
        folds: [[middles(asks.whole), inset(close.parts[0]!, big / 4, big / 2)]],
        wait: 0.25,
      }),
    ],
    words: [wall, bars, steps, asks, close].map((form) => form.count),
    x,
    y,
  };
}

export function shown(root: HTMLElement): void {
  const glyphs = new Glyphs(layerIn(root, "glyphs"));
  const forms = FORMS.map((form) =>
    root.querySelector<HTMLElement>(`.forms [data-form="${form}"]`),
  );
  let play: Play | null = null;

  scene(
    root,
    (f) => {
      glyphs.size(f.width, f.height);
      if (f.fresh || play === null) play = lay(f);
      // The move in hand is the last one begun. `at` counts the forms reached, each at its move's middle.
      let move = 0,
        at = 0,
        swap = 1;
      MOVES.forEach(([from, to], n) => {
        const u = span(f.p, from, to);
        if (u > 0) move = n;
        if (u >= 0.5) at = n + 1;
        swap = Math.min(swap, Math.abs(u - 0.5) / 0.06);
      });
      const [from, to] = MOVES[move]!;
      glyphs.clear();
      play.turns[move]!(glyphs, span(f.p, from, to));
      // The count swaps at the middle of a move, and dims as it does: no digit rolls, and nothing jolts.
      glyphs.text(`${play.words[at]} words`, play.x, play.y + READ / 2, READ, INK, DIM[1] * swap);
      glyphs.flush();
      forms.forEach((item, n) => item?.classList.toggle("on", n === at - 1));
    },
    { still: 0.33 },
  );
}
