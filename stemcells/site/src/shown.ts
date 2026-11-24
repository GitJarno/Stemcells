// The second idea: shown, not told. A wall of an agent's prose, in characters,
// collapses into the four forms a person reads fastest, each drawn solid as the
// app draws it: a chart, a diagram, a choice with a preview of each option, and
// one closing line. A count says how many words are left to read.

import { type Mark, READ } from "./kit/bodies.ts";
import { clamp, density, ease, lerp, span, touch } from "./kit/form.ts";
import { AMBER, Glyphs, INK, NIGHT, type Rgb } from "./kit/glyphs.ts";
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

const TITLE = "Search, p95 (ms)";
const BARS = [
  ["before", 840],
  ["cache", 310],
  ["index", 120],
] as const;
const STEPS = ["request", "cache", "index", "result"] as const;
/** What the way from the cache to the index is called. */
const ASIDE = "miss";
const WHO = "Otter asks";
const QUESTION = ["Ship the index now,", "or behind a flag?"] as const;
/** The recommended option first. */
const OPTIONS = ["Behind a flag", "Ship it now"] as const;
const DONE = ["Done: search is 7x faster.", "Tests pass."] as const;
const LEFT = "Left: nothing.";

/** The wall's ink: about half, so every form it becomes is brighter than it was. */
const WALL = 0.5;
const DIM = 0.68;
/** A cell is half as wide as it is tall. */
const W = READ / 2;
/** The count's row and a clear row under it. */
const HEAD = READ * 2;

/** When each form is reached along the scene: a move from..to, then a rest to read it. */
const MOVES = [
  [0.06, 0.25],
  [0.37, 0.47],
  [0.59, 0.69],
  [0.81, 0.91],
] as const;
const FORMS = ["chart", "diagram", "choice", "close"] as const;
/**
 * A move between two things, in parts of itself: the first one's type is gone by OUT, the solids
 * are set by SET, and the second one's type shows from IN, onto solids that are all but still.
 */
const OUT = 0.35,
  SET = 0.85,
  IN = 0.68;

type Rgba = readonly [number, number, number, number];
const RAISED: Rgb = [21, 21, 20];
const of = (rgb: Rgb, a = 1): Rgba => [rgb[0], rgb[1], rgb[2], a];
const ink = (a = 1): Rgba => of(INK, a);
const CLEAR = ink(0);
const blend = (a: Rgba, b: Rgba, u: number): Rgba => [
  lerp(a[0], b[0], u),
  lerp(a[1], b[1], u),
  lerp(a[2], b[2], u),
  lerp(a[3], b[3], u),
];
const css = ([r, g, b, a]: Rgba, alpha: number): string =>
  `rgb(${Math.round(r)} ${Math.round(g)} ${Math.round(b)} / ${a * alpha})`;

/** A solid: a rounded rectangle with a fill and a hairline, CSS pixels. */
interface Shape {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly r: number;
  readonly fill: Rgba;
  readonly line: Rgba;
}
const solid = (
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  fill: Rgba,
  line: Rgba = CLEAR,
): Shape => ({ x, y, w, h, r, fill, line });
/** One solid on its way to being another, `u` of the way; `across` is how far it has come sideways. */
const mix = (a: Shape, b: Shape, u: number, across = u): Shape => ({
  x: lerp(a.x, b.x, across),
  y: lerp(a.y, b.y, u),
  w: lerp(a.w, b.w, across),
  h: lerp(a.h, b.h, u),
  r: lerp(a.r, b.r, u),
  fill: blend(a.fill, b.fill, u),
  line: blend(a.line, b.line, u),
});

/** A line of type inside a thing, from `x` on the baseline `y`. */
interface Type {
  readonly text: string;
  readonly x: number;
  readonly y: number;
  readonly size: number;
  readonly bold?: boolean;
  readonly ink: Rgba;
  readonly align?: "left" | "center";
  /** Space after each character, for capitals set small. */
  readonly track?: number;
}

/** An arrowhead, by its tip. */
interface Head {
  readonly x: number;
  readonly y: number;
  readonly down: boolean;
}
const HEAD_LONG = 7,
  ARROW = ink(0.5);

const FONT = 'ui-monospace, "SF Mono", SFMono-Regular, Menlo, Consolas, monospace';
const font = (size: number, bold = false): string => `${bold ? 700 : 400} ${size}px ${FONT}`;
/** How far one character of the type at `size` advances. */
type Measure = (size: number, bold?: boolean) => number;

/** The layer the solids are drawn on: a 2D canvas over the pinned box. */
class Things {
  readonly canvas: HTMLCanvasElement;
  readonly #context: CanvasRenderingContext2D;
  #width = 0;
  #height = 0;
  #d = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.#context = canvas.getContext("2d")!;
  }

  size(width: number, height: number): void {
    const d = density();
    if (width === this.#width && height === this.#height && d === this.#d) return;
    this.#width = width;
    this.#height = height;
    this.#d = d;
    this.canvas.width = Math.round(width * d);
    this.canvas.height = Math.round(height * d);
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
  }

  clear(): void {
    this.#context.setTransform(this.#d, 0, 0, this.#d, 0, 0);
    this.#context.clearRect(0, 0, this.#width, this.#height);
  }

  readonly measure: Measure = (size, bold = false) => {
    this.#context.font = font(size, bold);
    return this.#context.measureText("0").width;
  };

  #trace(x: number, y: number, w: number, h: number, r: number): void {
    const context = this.#context,
      k = Math.max(0, Math.min(r, w / 2, h / 2));
    context.beginPath();
    context.moveTo(x + k, y);
    context.arcTo(x + w, y, x + w, y + h, k);
    context.arcTo(x + w, y + h, x, y + h, k);
    context.arcTo(x, y + h, x, y, k);
    context.arcTo(x, y, x + w, y, k);
    context.closePath();
  }

  shape({ x, y, w, h, r, fill, line }: Shape, alpha = 1): void {
    const context = this.#context;
    if (w <= 0 || h <= 0) return;
    if (fill[3] * alpha > 0.004) {
      context.fillStyle = css(fill, alpha);
      this.#trace(x, y, w, h, r);
      context.fill();
    }
    if (line[3] * alpha <= 0.004) return;
    // The hairline runs inside the edge, on half pixels.
    context.strokeStyle = css(line, alpha);
    context.lineWidth = 1;
    this.#trace(x + 0.5, y + 0.5, Math.max(0, w - 1), Math.max(0, h - 1), r - 0.5);
    context.stroke();
  }

  head({ x, y, down }: Head, alpha = 1): void {
    const context = this.#context;
    context.fillStyle = css(ARROW, alpha);
    context.beginPath();
    context.moveTo(x, y);
    if (down) {
      context.lineTo(x - 4, y - HEAD_LONG);
      context.lineTo(x + 4, y - HEAD_LONG);
    } else {
      context.lineTo(x - HEAD_LONG, y - 4);
      context.lineTo(x - HEAD_LONG, y + 4);
    }
    context.fill();
  }

  type({ text, x, y, size, bold, ink: colour, align = "left", track = 0 }: Type, alpha = 1): void {
    const context = this.#context;
    if (colour[3] * alpha <= 0.004) return;
    context.font = font(size, bold);
    context.fillStyle = css(colour, alpha);
    context.textBaseline = "alphabetic";
    context.textAlign = align;
    if (track === 0) return void context.fillText(text, x, y);
    let at = x;
    for (const ch of text) {
      context.fillText(ch, at, y);
      at += context.measureText(ch).width + track;
    }
  }
}

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

/** A box, CSS pixels. */
interface Box {
  readonly x: number;
  readonly y: number;
  readonly wide: number;
  readonly tall: number;
}

/** A word of the wall, and the marks that spell it. */
interface Word {
  readonly key: string;
  readonly marks: readonly Mark[];
}

/** The wall: the report in characters, in as many bands of lines as the chart has bars. */
interface Page {
  readonly bands: readonly { readonly box: Box; readonly marks: readonly Mark[] }[];
  readonly words: readonly Word[];
  readonly count: number;
}

/** The report wrapped to `cols` and cut to `rows`, its top left cell at (x, y). */
function page(x: number, y: number, cols: number, rows: number): Page {
  const lines = REPORT.flatMap((paragraph) => wrap(paragraph, cols)).slice(0, rows);
  const words: Word[] = [];
  const inked = lines.map((line, row) => {
    const marks = [...line].map((ch, i): Mark => ({
      x: x + (i + 0.5) * W,
      y: y + (row + 0.5) * READ,
      ch,
      h: READ,
      rgb: INK,
      a: WALL,
    }));
    for (const word of line.matchAll(/[A-Za-z0-9]+/g))
      words.push({
        key: word[0].toLowerCase(),
        marks: marks.slice(word.index, word.index + word[0].length),
      });
    return marks.filter((mark) => mark.ch !== " ");
  });
  const bands = BARS.map((_, n) => {
    const top = Math.round((n * lines.length) / BARS.length),
      end = Math.round(((n + 1) * lines.length) / BARS.length);
    return {
      box: { x, y: y + top * READ, wide: cols * W, tall: (end - top) * READ },
      marks: inked.slice(top, end).flat(),
    };
  });
  return { bands, words, count: lines.reduce((n, line) => n + wordsIn(line), 0) };
}

/** A form drawn solid, where it stands. */
interface Form {
  /** Its solid parts: they turn into the next form's. */
  readonly solids: readonly Shape[];
  /** The hairlines that run under them: an axis, an arrow's line and its head. */
  readonly rules: readonly Shape[];
  readonly heads: readonly Head[];
  /** What is drawn on them: a preview's picture. */
  readonly marks: readonly Shape[];
  readonly type: readonly Type[];
  /** Its top left corner: the count stands over it. */
  readonly x: number;
  readonly y: number;
}
const counted = (form: Form): number => form.type.reduce((n, line) => n + wordsIn(line.text), 0);

/** Where a form `wide` by `tall` stands: in the middle of the art box, and under the count. */
const place = (room: Box, wide: number, tall: number): { x: number; y: number } => ({
  x: room.x + Math.round((room.wide - wide) / 2),
  y: room.y + Math.max(0, Math.round((room.tall - HEAD - tall) / 2)),
});
/** How wide a form stands: `least`, more of a box with more to give, never more than the box. */
const reach = (room: Box, least: number, share = 0.86): number =>
  Math.min(room.wide, Math.max(least, Math.round(room.wide * share)));
/** The baseline that sets type of `size` with its middle on `y`. */
const middle = (y: number, size: number): number => Math.round(y + size * 0.34);

/** Numbers to compare: a bar each, its length true to its number, on one baseline. */
function chart(room: Box, narrow: boolean, measure: Measure): Form {
  const big = narrow ? 13 : 15;
  const wide = reach(room, 720);
  const label =
      Math.ceil(Math.max(...BARS.map(([name]) => name.length)) * measure(13)) + (narrow ? 10 : 16),
    number = Math.ceil(3 * measure(big, true)) + 12;
  const most = Math.max(64, Math.round(wide / 11)),
    thick = clamp(Math.floor((room.tall - big - 14) / 4.5), 24, most),
    gap = Math.round(thick / 2);
  const tall = big + gap + BARS.length * thick + (BARS.length - 1) * gap;
  const { x, y } = place(room, wide, tall);
  const left = x + label,
    top = y + big + gap,
    longest = wide - label - number;
  const solids = BARS.map(([, ms], n) =>
    solid(left, top + n * (thick + gap), Math.round((ms / BARS[0][1]) * longest), thick, 4, ink()),
  );
  return {
    solids,
    rules: [solid(left - 1, top - 8, 1, tall - big - gap + 16, 0, ink(0.22))],
    heads: [],
    marks: [],
    type: [
      { text: TITLE, x, y: y + Math.round(big * 0.74), size: big, bold: true, ink: ink() },
      ...BARS.flatMap(([name, ms], n): Type[] => {
        const bar = solids[n]!,
          at = bar.y + thick / 2;
        return [
          { text: name, x, y: middle(at, 13), size: 13, ink: ink(DIM) },
          {
            text: String(ms),
            x: bar.x + bar.w + 12,
            y: middle(at, big),
            size: big,
            bold: true,
            ink: ink(),
          },
        ];
      }),
    ],
    x,
    y,
  };
}

/** A flow: the request's way to its result, left to right, or top to bottom where it is narrow. */
function flow(room: Box, down: boolean): Form {
  const unit = room.tall / 6.1,
    wide = reach(room, 760);
  const gap = down
      ? clamp(Math.floor(unit * 0.7), 18, 40)
      : clamp(Math.round(wide * 0.085), 44, 66),
    w = down ? Math.min(room.wide, 184) : Math.floor((wide - 3 * gap) / 4),
    h = down ? clamp(Math.floor(unit), 28, 56) : Math.min(Math.round(w * 0.64), room.tall);
  const last = STEPS.length - 1;
  const { x, y } = place(room, down ? w : w * 4 + gap * last, down ? h * 4 + gap * last : h);
  // An arrow stands clear of both the steps it joins.
  const air = gap >= 28 ? 8 : 4,
    long = gap - air * 2 - HEAD_LONG;
  const solids: Shape[] = [],
    rules: Shape[] = [],
    heads: Head[] = [],
    type: Type[] = [];
  STEPS.forEach((step, n) => {
    const bx = x + (down ? 0 : n * (w + gap)),
      by = y + (down ? n * (h + gap) : 0);
    const cx = bx + Math.floor(w / 2),
      cy = by + Math.floor(h / 2);
    solids.push(solid(bx, by, w, h, 8, of(RAISED), ink(0.22)));
    type.push({
      text: step,
      x: cx,
      y: middle(cy, 13),
      size: 13,
      ink: ink(),
      align: "center",
    });
    if (n === 0) return;
    const aside = step === "index";
    if (down) {
      rules.push(solid(cx, by - gap + air, 1, long, 0, ARROW));
      heads.push({ x: cx + 0.5, y: by - air, down });
      if (aside)
        type.push({
          text: ASIDE,
          x: cx + 12,
          y: middle(by - gap / 2, 11),
          size: 11,
          ink: ink(DIM),
        });
    } else {
      rules.push(solid(bx - gap + air, cy, long, 1, 0, ARROW));
      heads.push({ x: bx - air, y: cy + 0.5, down });
      if (aside)
        type.push({
          text: ASIDE,
          x: bx - gap / 2,
          y: cy - 9,
          size: 11,
          ink: ink(DIM),
          align: "center",
        });
    }
  });
  return { solids, rules, heads, marks: [], type, x, y };
}

/** How many steps a rollout behind a flag is drawn in. */
const RAMP = 5;

/**
 * A choice, as the page's own question card: who asks, one question, and a tile an option with a
 * preview in it. The recommended one is the filled one. Its solids are the card, the tiles, then
 * the previews.
 */
function ask(room: Box, narrow: boolean, measure: Measure): Form {
  const tight = room.tall < 230;
  const pad = narrow ? (tight ? 10 : 14) : 20,
    between = narrow ? (tight ? 6 : 8) : 12;
  const wide = narrow ? Math.min(room.wide, 420) : reach(room, 600, 0.64);
  const question = narrow ? QUESTION : [QUESTION.join(" ")];
  const size = narrow ? 15 : 16,
    lead = size + 5;
  // Over the tiles: who asks, the question, and the air around them.
  const over = 11 + (tight ? 7 : 11) + question.length * lead - 5 + (tight ? 9 : 17);
  const tileW = narrow ? wide - pad * 2 : Math.floor((wide - pad * 2 - between) / 2);
  const peekH = clamp(room.tall - pad * 2 - over - 44, 44, Math.round(tileW * 0.38));
  const tileH = narrow
    ? clamp(Math.floor((room.tall - pad * 2 - over - between) / 2), 38, 68)
    : peekH + 44;
  const tall = pad * 2 + over + (narrow ? tileH * 2 + between : tileH);
  const { x, y } = place(room, wide, tall);
  const top = y + pad + over;

  const tiles: Shape[] = [],
    peeks: Shape[] = [],
    marks: Shape[] = [];
  const type: Type[] = [
    { text: WHO.toUpperCase(), x: x + pad, y: y + pad + 9, size: 11, ink: of(AMBER), track: 1.3 },
    ...question.map((text, n): Type => ({
      text,
      x: x + pad,
      y: y + pad + 11 + (tight ? 7 : 11) + Math.round(size * 0.74) + n * lead,
      size,
      bold: true,
      ink: ink(),
    })),
  ];
  OPTIONS.forEach((label, n) => {
    const best = n === 0;
    const tx = x + pad + (narrow ? 0 : n * (tileW + between)),
      ty = top + (narrow ? n * (tileH + between) : 0);
    // A tile in a row holds its preview on the right; a tile in a column holds it on top.
    const edge = narrow ? (tileH >= 52 ? 8 : 6) : 10;
    const pw = narrow ? Math.round(tileW * 0.42) : tileW - edge * 2,
      ph = narrow ? tileH - edge * 2 : peekH;
    const px = tx + tileW - edge - pw,
      py = ty + edge;
    tiles.push(solid(tx, ty, tileW, tileH, 8, best ? ink() : of(NIGHT), best ? ink() : ink(0.22)));
    peeks.push(solid(px, py, pw, ph, 5, of(best ? NIGHT : RAISED), best ? CLEAR : ink(0.16)));

    const m = ph >= 60 ? 12 : 7,
      iw = pw - m * 2,
      ih = ph - m * 2,
      step = ph >= 60 ? 6 : 4;
    if (best)
      // Behind a flag: a share at a time, until it is everyone.
      for (let k = 0; k < RAMP; k++) {
        const from = Math.round((k * (iw + step)) / RAMP),
          to = Math.round(((k + 1) * (iw + step)) / RAMP) - step,
          up = Math.round((ih * (k + 1)) / RAMP);
        marks.push(solid(px + m + from, py + m + ih - up, to - from, up, 2, ink()));
      }
    // Now: everyone at once.
    else marks.push(solid(px + m, py + m, iw, ih, 2, ink(DIM)));

    const base = narrow ? middle(ty + tileH / 2, 13) : py + ph + 22,
      colour = best ? NIGHT : INK;
    // A finger has no number keys.
    if (!touch)
      type.push({ text: String(n + 1), x: tx + 12, y: base, size: 13, ink: of(colour, 0.55) });
    type.push({
      text: label,
      x: tx + 12 + (touch ? 0 : Math.round(measure(13)) + 6),
      y: base,
      size: 13,
      ink: of(colour),
    });
  });
  const card = solid(x, y, wide, tall, 14, of(NIGHT), of(AMBER, 0.5));
  return { solids: [card, ...tiles, ...peeks], rules: [], heads: [], marks, type, x, y };
}

/** Where it stands: what is done, large, on one hairline, and under it what is left. */
function closing(room: Box, narrow: boolean, measure: Measure): Form {
  const lines = narrow ? DONE : [DONE.join(" ")];
  const longest = Math.max(...lines.map((line) => line.length)),
    limit = reach(room, 760);
  const size =
    (narrow ? [22, 20, 18, 17, 16] : [40, 36, 32, 30, 28, 26, 24, 22, 20]).find(
      (s) => longest * measure(s, true) <= limit,
    ) ?? 15;
  const lead = Math.round(size * 1.3),
    cap = Math.round(size * 0.74),
    air = Math.max(12, Math.round(size * 0.55));
  const wide = Math.ceil(longest * measure(size, true)),
    rule = (lines.length - 1) * lead + cap + air;
  // In a hand the line starts at the margin, as the words under it do.
  const { x, y } = place(narrow ? { ...room, wide } : room, wide, rule + 25);
  return {
    solids: [solid(x, y + rule, wide, 1, 0, of(NIGHT, 0), ink(0.22))],
    rules: [],
    heads: [],
    marks: [],
    type: [
      ...lines.map((text, n): Type => ({
        text,
        x,
        y: y + cap + n * lead,
        size,
        bold: true,
        ink: ink(),
      })),
      { text: LEFT, x, y: y + rule + 25, size: 13, ink: ink(0.42) },
    ],
    x,
    y,
  };
}

/** One picture turning into the next, drawn at `u`: 0 is the first, 1 the second. It says how far its solids have come. */
type Turn = (things: Things, glyphs: Glyphs, u: number) => number;

/** What runs under a form's solids, at `alpha`. */
function under(things: Things, form: Form, alpha: number): void {
  if (alpha <= 0) return;
  for (const rule of form.rules) things.shape(rule, alpha);
  for (const head of form.heads) things.head(head, alpha);
}
/** What stands on a form's solids, at `alpha`. */
function over(things: Things, form: Form, alpha: number): void {
  if (alpha <= 0) return;
  for (const mark of form.marks) things.shape(mark, alpha);
  for (const line of form.type) things.type(line, alpha);
}

/**
 * Things turn into things: each pair of solids eases from the first to the second, and the type
 * cross-fades. With a `lead` under 1 the solids are in their columns that much sooner than on
 * their row: a stack becomes a row and no two cross.
 */
const turn =
  (from: Form, to: Form, pairs: readonly (readonly [Shape, Shape])[], lead = 1): Turn =>
  (things, _, u) => {
    const e = ease.inOut(span(u, 0, SET)),
      across = ease.inOut(span(u, 0, SET * lead)),
      out = 1 - span(u, 0, OUT),
      into = span(u, IN, 1);
    under(things, from, out);
    under(things, to, into);
    for (const [a, b] of pairs) things.shape(mix(a, b, e, across));
    over(things, from, out);
    over(things, to, into);
    return e;
  };

/** A character of the wall on its way: to a place and a size. */
interface Flight {
  readonly from: Mark;
  readonly to: Mark;
}

/** The air a bar keeps around the lines that gather in it. */
const EDGE = 5;
/** How much of the move a word takes to ride out of the wall, and when it hands over to the chart's own type. */
const RIDE = 0.72,
  LAND = 0.8;

/**
 * Words become things: each band of the wall's lines gathers into its bar, on a slab that fills
 * in as the lines shrink into it. The words the chart keeps ride out to where its type stands.
 */
function collapse(wall: Page, bars: Form, measure: Measure): Turn {
  const top = wall.bands[0]!.box;
  const slabs = wall.bands.map(({ box }, n) => {
    const bar = bars.solids[n]!;
    return [{ ...bar, x: box.x, y: box.y, w: box.wide, h: box.tall, fill: CLEAR }, bar] as const;
  });
  // A line of the chart's type keeps its place by its slab while the slab shrinks: at the end of
  // the bar it stands beside, or, the title, under the count. So every frame on the way is a chart.
  const ties = bars.type.map((line) => {
    const by = bars.solids.findIndex((bar) => line.y > bar.y && line.y < bar.y + bar.h);
    const right = by >= 0 && line.x > bars.solids[by]!.x;
    // How far the line may stand off its place and still be in the wall's width.
    const room = right
      ? top.x + top.wide - line.x - line.text.length * measure(line.size, line.bold)
      : top.x - line.x;
    return { by, right, room };
  });
  const offset = (line: number, now: readonly Shape[], e: number): readonly [number, number] => {
    const { by, right, room } = ties[line]!;
    if (by < 0) return [(top.x - bars.x) * (1 - e), (top.y - bars.y) * (1 - e)];
    const slab = now[by]!,
      bar = bars.solids[by]!;
    return [
      right
        ? Math.min(slab.x + slab.w - bar.x - bar.w, Math.max(0, room))
        : Math.max(slab.x - bar.x, Math.min(0, room)),
      slab.y + slab.h / 2 - bar.y - bar.h / 2,
    ];
  };

  // The chart's type, a character at a time, as the glyphs that hand over to it. A word the wall
  // has too rides out of the wall; what the wall on screen lacks shows where it will stand.
  const spent = new Set<Word>(),
    rides: { readonly from: Mark | undefined; readonly to: Mark; readonly line: number }[] = [];
  bars.type.forEach((line, n) => {
    const h = line.size / 0.8,
      step = measure(line.size, line.bold);
    const from = new Map<number, Mark>();
    for (const word of line.text.matchAll(/[A-Za-z0-9]+/g)) {
      const key = word[0].toLowerCase(),
        twin = wall.words.find((other) => other.key === key && !spent.has(other));
      if (twin === undefined) continue;
      spent.add(twin);
      twin.marks.forEach((mark, i) => from.set(word.index + i, mark));
    }
    [...line.text].forEach((ch, i) => {
      if (ch === " ") return;
      // A glyph's baseline is 0.76 down its cell: where the type's own character will stand.
      const to = { x: line.x + (i + 0.5) * step, y: line.y - 0.26 * h, ch, h, rgb: INK };
      rides.push({ from: from.get(i), to: { ...to, a: line.ink[3] }, line: n });
    });
  });
  const riding = new Set(rides.map((ride) => ride.from));
  const falls = wall.bands.flatMap(({ box, marks }, n) => {
    const bar = bars.solids[n]!;
    const sx = Math.max(0, bar.w - EDGE * 2) / box.wide,
      sy = Math.max(0, bar.h - EDGE * 2) / box.tall;
    return marks
      .filter((mark) => !riding.has(mark))
      .map((mark): Flight => ({
        from: mark,
        to: {
          ...mark,
          x: bar.x + EDGE + (mark.x - box.x) * sx,
          y: bar.y + EDGE + (mark.y - box.y) * sy,
          h: mark.h * sy,
        },
      }));
  });
  return (things, glyphs, u) => {
    const e = ease.inOut(u),
      landed = span(u, LAND, 1),
      now = slabs.map(([a, b]) => mix(a, b, e)),
      offsets = bars.type.map((_, line) => offset(line, now, e));
    under(things, bars, landed);
    for (const slab of now) things.shape({ ...slab, fill: ink(e * e) });
    bars.type.forEach((line, n) => {
      const [dx, dy] = offsets[n]!;
      things.type({ ...line, x: line.x + dx, y: line.y + dy }, landed);
    });
    if (u >= 1) return e;
    for (const { from, to } of falls)
      glyphs.put(
        from.ch,
        lerp(from.x, to.x, e),
        lerp(from.y, to.y, e),
        lerp(from.h, to.h, e),
        INK,
        WALL,
      );
    // A word is in its place before its slab is a bar, so nothing lands at once. What the wall
    // lacks shows as the riders land: a comma never stands alone.
    const r = ease.inOut(span(u, 0, RIDE)),
      shows = span(u, RIDE - 0.12, RIDE);
    // A glyph's ink over the type's own, showing through under it: together they keep the ink `a`.
    const kept = (a: number): number => 1 - (1 - a) / (1 - a * landed);
    for (const { from, to, line } of rides) {
      const [dx, dy] = offsets[line]!;
      if (from === undefined) {
        glyphs.put(to.ch, to.x + dx, to.y + dy, to.h, INK, kept(to.a * shows));
        continue;
      }
      const x = lerp(from.x, to.x + dx, r),
        y = lerp(from.y, to.y + dy, r),
        h = lerp(from.h, to.h, r),
        a = kept(lerp(from.a, to.a, r));
      // A letter that changes its case does so mid-air.
      const swap = from.ch === to.ch ? 1 : span(r, 0.3, 0.7);
      glyphs.put(to.ch, x, y, h, INK, a * swap);
      if (swap < 1) glyphs.put(from.ch, x, y, h, INK, a * (1 - swap));
    }
    return e;
  };
}

interface Play {
  readonly turns: readonly Turn[];
  /** The words on screen: the wall's, then each form's. */
  readonly words: readonly number[];
  /** Where the count stands for each: over its top left corner. */
  readonly spots: readonly { readonly x: number; readonly y: number }[];
}

/** The wall is a page, not a banner: it stops at this many columns and stands in the middle. */
const PAGE = 104;

/** Lays the wall and the four forms out in the art box. */
function lay(f: SceneFrame, measure: Measure): Play {
  const cols = Math.max(1, Math.min(PAGE, Math.floor(f.art.width / W))),
    rows = Math.max(1, Math.floor((f.art.height - HEAD) / READ));
  const spare = f.art.width - cols * W;
  const x = Math.round(f.art.x + (spare > W ? spare / 2 : 0)),
    y = Math.round(f.art.y);
  // A hand gets drawings of its own: the flow top to bottom, the options in a column, the line in two.
  const narrow = f.form === "phone" || f.art.width < 560;
  const room: Box = {
    x: Math.round(f.art.x),
    y: y + HEAD,
    wide: Math.floor(f.art.width),
    tall: Math.floor(f.art.height) - HEAD,
  };
  const wall = page(x, y + HEAD, cols, rows),
    bars = chart(room, narrow, measure),
    steps = flow(room, narrow),
    asks = ask(room, narrow, measure),
    close = closing(room, narrow, measure);
  const forms = [bars, steps, asks, close];

  const [long, mid, short] = bars.solids as [Shape, Shape, Shape];
  const [first, second, third, fourth] = steps.solids as [Shape, Shape, Shape, Shape];
  const [card, tile, other, peek, glance] = asks.solids as [Shape, Shape, Shape, Shape, Shape];
  // The flow has a step more than the chart has bars, so one bar parts in two. Across, it is the
  // long one, which already reaches where the last steps stand: no bar crosses another.
  const half = long.w / 2 + long.r;
  const parted: readonly (readonly [Shape, Shape])[] = narrow
    ? [
        [long, first],
        [mid, second],
        [short, third],
        [short, fourth],
      ]
    : [
        [short, first],
        [mid, second],
        [{ ...long, w: half }, third],
        [{ ...long, x: long.x + long.w - half, w: half }, fourth],
      ];
  const clear = (shape: Shape): Shape => ({
    ...shape,
    fill: of([shape.fill[0], shape.fill[1], shape.fill[2]], 0),
    line: CLEAR,
  });
  // The card opens around the flow: its seed is the box the four steps stand in.
  const right = fourth.x + fourth.w,
    foot = fourth.y + fourth.h;
  const seed: Shape = {
    ...card,
    x: first.x - 16,
    y: first.y - 16,
    w: right - first.x + 32,
    h: foot - first.y + 32,
    fill: of(NIGHT, 0),
    line: of(AMBER, 0),
  };
  const behind = (shape: Shape, { x, y, w, h }: Shape): Shape => ({ ...clear(shape), x, y, w, h });
  // A preview grows inside its tile: it starts where it would stand in the step the tile was.
  const within = (inner: Shape, outer: Shape, step: Shape): Shape => ({
    ...clear(inner),
    x: step.x + ((inner.x - outer.x) * step.w) / outer.w,
    y: step.y + ((inner.y - outer.y) * step.h) / outer.h,
    w: (inner.w * step.w) / outer.w,
    h: (inner.h * step.h) / outer.h,
  });
  // The card folds flat onto the closing line's rule, and what is in it with it.
  const rule = close.solids[0]!,
    k = rule.w / card.w;
  const flat = (shape: Shape): Shape => ({
    ...clear(shape),
    x: rule.x + (shape.x - card.x) * k,
    y: rule.y,
    w: shape.w * k,
    h: 0,
    r: 0,
  });
  return {
    turns: [
      collapse(wall, bars, measure),
      turn(bars, steps, parted, narrow ? 1 : 0.6),
      // The inner steps become the tiles; the outer ones slip behind them and are gone.
      turn(steps, asks, [
        [seed, card],
        [first, behind(first, tile)],
        [fourth, behind(fourth, other)],
        [second, tile],
        [third, other],
        [within(peek, tile, second), peek],
        [within(glance, other, third), glance],
      ]),
      turn(asks, close, [
        [card, rule],
        ...[tile, other, peek, glance].map((shape) => [shape, flat(shape)] as const),
      ]),
    ],
    words: [wall.count, ...forms.map(counted)],
    spots: [{ x, y }, ...forms.map((form) => ({ x: narrow ? room.x : form.x, y: form.y - HEAD }))],
  };
}

export function shown(root: HTMLElement): void {
  // The characters lie over the solids: a slab fills in under its lines.
  const glyphs = new Glyphs(layerIn(root, "glyphs")),
    things = new Things(layerIn(root, "things"));
  const forms = FORMS.map((form) =>
    root.querySelector<HTMLElement>(`.forms [data-form="${form}"]`),
  );
  let play: Play | null = null,
    drawn = "";
  // A layer that comes back from a lost context is drawn again, whatever the scroll.
  glyphs.canvas.addEventListener("webglcontextrestored", () => (drawn = ""));

  scene(
    root,
    (f) => {
      // A frame is its progress and nothing else, so a scroll at rest draws nothing.
      const frame = `${f.p} ${density()}`;
      if (!f.fresh && play !== null && frame === drawn) return;
      drawn = frame;
      glyphs.size(f.width, f.height);
      things.size(f.width, f.height);
      if (f.fresh || play === null) play = lay(f, things.measure);
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
      const [from, to] = MOVES[move]!,
        u = span(f.p, from, to);
      glyphs.clear();
      things.clear();
      const e = play.turns[move]!(things, glyphs, u);
      // The count rides with its form's corner. It swaps at the middle of a move, and dims as it does.
      const a = play.spots[move]!,
        b = play.spots[move + 1]!;
      glyphs.text(
        `${play.words[at]} words`,
        lerp(a.x, b.x, e),
        lerp(a.y, b.y, e) + READ / 2,
        READ,
        INK,
        DIM * swap,
      );
      glyphs.flush();
      forms.forEach((item, n) => item?.classList.toggle("on", n === at - 1));
    },
    { still: 0.33 },
  );
}
