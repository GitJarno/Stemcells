// The third scene: it becomes what you need. A Cell grows with the time it
// works alone, at the app's own marks (`cell/growth.ts`). Then the app: one
// chat, two side by side, a crew in tabs and panes, a phone. A phone is shown
// its own shape first and ends on the Mac.

import {
  type CellLook,
  grown,
  type MiniFrame,
  sceneOf,
  type Strength,
  tossFrame,
} from "./app-cells.ts";
import { type Cell, crew, drawCell, frameAt } from "./cells.ts";
import { type Body, drawBody, type Mark, textBody } from "./kit/bodies.ts";
import { density, ease, hash, lerp, span } from "./kit/form.ts";
import { Glyphs, INK, NIGHT, type Rgb } from "./kit/glyphs.ts";
import { layerIn, scene, type SceneFrame } from "./kit/scenes.ts";

const CREW = [
  ["Otter", "claude"],
  ["Waffle", "codex"],
  ["Pickle", "gemini"],
  ["Kiwi", "kimi"],
] as const;
/** What each is doing in its chat. */
const WORK = ["busy/0", "reading/0", "searching/0", "testing/0"] as const;

/** A strength, from when in the story it is worn, the time alone that grew it, and its line. */
const TIERS: readonly {
  at: number;
  strength: Strength | undefined;
  doing: string;
  minutes: number;
  beat: string;
}[] = [
  { at: 0, strength: undefined, doing: "busy/0", minutes: 4, beat: "A Cell starts plain." },
  {
    at: 0.11,
    strength: "nubs",
    doing: "building/0",
    minutes: 10,
    beat: "Ten minutes on its own: nubs.",
  },
  { at: 0.22, strength: "arms", doing: "testing/0", minutes: 30, beat: "Thirty: arms." },
  {
    at: 0.33,
    strength: "biceps",
    doing: "happy",
    minutes: 120,
    beat: "Two hours. Look at those arms.",
  },
];
/** How much of the story the meter takes to fill up to a mark, and a new strength's bounce to settle. */
const FILL = 0.04,
  BOUNCE = 0.03;
/** The bounce: a landing at this speed, CSS px a second, over this long. */
const HIT = 300,
  BOUNCE_MS = 600;
/** The flex's arms go up over this much of the story after the bounce, and come down before the app's turn. */
const RAISE = 0.025,
  LOWER = 0.02;

/** Each turn of the app's shape: from when to when. Its line is said halfway. */
const TURNS = [
  [0.5, 0.59],
  [0.635, 0.705],
  [0.75, 0.82],
  [0.87, 0.955],
] as const;
const SHAPED = {
  desk: [
    "One chat.",
    "Two, side by side.",
    "A whole crew, in tabs and panes.",
    "Or in your pocket.",
  ],
  phone: [
    "One chat, in your pocket.",
    "Two.",
    "A whole crew.",
    "Or on your Mac, in tabs and panes.",
  ],
} as const;
const STAGES = ["Input", "Flying", "Landed", "Settled"] as const;

/**
 * Ink thinned to a share of itself, as a colour and not as see-through ink:
 * two hairlines that cross on their way stay one hairline's grey.
 */
const thin = (share: number): Rgb => [
  lerp(NIGHT[0], INK[0], share),
  lerp(NIGHT[1], INK[1], share),
  lerp(NIGHT[2], INK[2], share),
];
/** Ink for the chrome's hairlines, a quiet label, and what a chat says. */
const HAIR = thin(0.36),
  QUIET = thin(0.55),
  SAID = thin(0.3);
/** A paragraph's lines as shares of the chat's width; 0 is the gap between two. */
const LINES = [1, 0.8, 0.55, 0, 0.9, 0.6, 0, 1, 0.75, 0.9, 0.45, 0] as const;
/** The ground's dots sit this far under a Cell's feet, CSS pixels. */
const FEET = 3;
/** A Cell's art above its feet and across, art pixels. */
const ABOVE = 30,
  ACROSS = 34;

/** Where a Cell stands: its feet, CSS pixels, and CSS pixels an art pixel. */
interface Seat {
  readonly x: number;
  readonly y: number;
  readonly px: number;
}
/**
 * One shape the app takes: where each of the crew stands in it, if it does,
 * and its characters by the part they play (`top`, `bar`, `name0`, …), so a
 * part can turn into the same part of the next shape.
 */
interface Shape {
  readonly seats: readonly (Seat | undefined)[];
  readonly parts: ReadonlyMap<string, Body>;
}
/** A drawing's grid: its corner, CSS pixels, its cells, and how large its Cells stand. */
interface Box {
  readonly x: number;
  readonly y: number;
  readonly cols: number;
  readonly rows: number;
  readonly h: number;
  readonly small: number;
  /** Columns between a chat's edge and what is in it: the same however the box is divided. */
  readonly inset: number;
  /** Rows of air over a Cell's head: the same however the box is divided, so a chat that divides stays put. */
  readonly air: number;
}
type Pairs = readonly (readonly [Mark, Mark])[];
/**
 * One shape turning into the next: what both share holds still, what keeps
 * its characters rides to its new place, and what has no counterpart comes or
 * goes in a wave. The kit's `Morph` reads as noise between two line drawings.
 */
interface Turn {
  readonly still: Body;
  readonly swaps: Pairs;
  readonly rides: Pairs;
  readonly lines: readonly (readonly [Body, Body])[];
  readonly blocks: readonly (readonly [Body, Body])[];
  readonly enters: readonly Passing[];
  readonly leaves: readonly Passing[];
}
type Passing = readonly [mark: Mark, from: number, to: number];

/** A grid of characters, each playing a part, with hairlines that join where they meet. */
class Sheet {
  readonly #cols: number;
  readonly #text = new Map<number, readonly [string, Rgb]>();
  readonly #lines = new Map<number, number>();
  readonly #parts = new Map<number, string>();

  constructor(cols: number) {
    this.#cols = cols;
  }

  /** A hairline along a row or a column, from (c0, r0) to (c1, r1). Where two meet, the first's part keeps the joint. */
  line(part: string, c0: number, r0: number, c1: number, r1: number): this {
    for (let r = r0; r <= r1; r++)
      for (let c = c0; c <= c1; c++) {
        const at = r * this.#cols + c;
        const joins = (r > r0 ? 1 : 0) | (c < c1 ? 2 : 0) | (r < r1 ? 4 : 0) | (c > c0 ? 8 : 0);
        this.#lines.set(at, (this.#lines.get(at) ?? 0) | joins);
        if (!this.#parts.has(at)) this.#parts.set(at, part);
      }
    return this;
  }

  write(part: string, c: number, r: number, text: string, rgb: Rgb): this {
    [...text].forEach((ch, n) => {
      if (ch === " ") return;
      this.#text.set(r * this.#cols + c + n, [ch, rgb]);
      this.#parts.set(r * this.#cols + c + n, part);
    });
    return this;
  }

  /** The sheet laid out in `box`, its marks by part, each part in reading order. */
  shape(box: Box, seats: readonly (Seat | undefined)[]): Shape {
    const { h } = box;
    // Up, right, down and left as bits: the character that joins them.
    const joint = " │─└││┌├─┘─┴┐┤┬┼";
    const parts = new Map<string, Mark[]>();
    for (const [at, part] of [...this.#parts].sort(([a], [b]) => a - b)) {
      const [ch, rgb] = this.#text.get(at) ?? [joint[this.#lines.get(at)!]!, HAIR];
      const marks = parts.get(part) ?? [];
      marks.push({
        x: box.x + ((at % this.#cols) + 0.5) * (h / 2),
        y: box.y + (Math.floor(at / this.#cols) + 0.5) * h,
        ch,
        h,
        rgb,
        a: 1,
      });
      parts.set(part, marks);
    }
    return { seats, parts };
  }
}

const spoken = new Map<number, boolean[]>();
/**
 * Whether column `c` of row `r` has ink when something is said there: rules a
 * few columns long for its words. The same wherever a chat's share falls, so a
 * chat that divides keeps its lines where they are.
 */
function inked(c: number, r: number): boolean {
  let row = spoken.get(r);
  if (row === undefined) {
    row = [];
    for (let n = 0; row.length < 200; n++) {
      const word = 3 + Math.floor(hash(n, r * 7 + 1) * 7);
      for (let i = 0; i < word; i++) row.push(true);
      row.push(false);
    }
    spoken.set(r, row);
  }
  return row[c] ?? false;
}

/** A line said on row `r` from column `c`, `limit` wide: it starts on a word, and no stub of one ends it. */
function said(c: number, r: number, limit: number): string {
  const line = Array.from({ length: Math.max(0, limit) }, (_, n) => inked(c + n, r));
  const first = line.indexOf(false),
    last = line.lastIndexOf(false);
  if (first >= 0 && first < 3) line[first] = true;
  if (last >= 0 && line.length - 1 - last < 3) line.fill(false, last);
  return line.map((ink) => (ink ? "─" : " ")).join("");
}

const cut = (n: number, of: number, from: number, to: number): number =>
  from + Math.round((n * (to - from)) / of);
/** Rows from the top of a chat's share to the ground its Cell stands on, its head at the very top. */
const headed = (h: number, small: number): number => Math.ceil((ABOVE * small + FEET - h / 2) / h);

/**
 * A chat in its share of a sheet: the Cell on a few dots of ground, its name and
 * its last line beside it, and what it said before under them, as far as the
 * share goes and no more than `most` rows. Returns where the Cell stands.
 */
function chat(
  sheet: Sheet,
  box: Box,
  who: number,
  c0: number,
  r0: number,
  cols: number,
  rows: number,
  most: number,
): Seat {
  const { h, small, inset } = box,
    w = h / 2;
  const dots = Math.ceil((ACROSS * small) / w / 2);
  const ground = r0 + headed(h, small) + box.air;
  const left = c0 + inset,
    beside = left + dots * 2,
    right = c0 + cols - inset;
  for (let n = 0; n < dots; n++) sheet.write(`ground${who}`, left + n * 2, ground, "·", HAIR);
  sheet.write(`name${who}`, beside, ground - 2, CREW[who]![0], INK);
  const words = `said${who}`;
  sheet.write(
    words,
    beside,
    ground - 1,
    said(beside, ground - 1, Math.min(16, right - beside)),
    SAID,
  );
  for (let r = ground + 2, n = 0; r < r0 + rows - 1 && n < most; r++, n++) {
    const share = LINES[n % LINES.length]!;
    if (share > 0)
      sheet.write(words, left, r, said(left, r, Math.floor((right - left) * share)), SAID);
  }
  return { x: box.x + (left + dots - 0.5) * w, y: box.y + (ground + 0.5) * h - FEET, px: small };
}

/**
 * A sheet with the outline both the window and the phone have: four sides, and
 * the rule of its bar on row `bar`, which keeps the joints where it meets them.
 */
function outlined(box: Box, bar: number): Sheet {
  const { cols, rows } = box;
  return new Sheet(cols)
    .line("top", 0, 0, cols - 1, 0)
    .line("bottom", 0, rows - 1, cols - 1, rows - 1)
    .line("bar", 0, bar, cols - 1, bar)
    .line("left", 0, 0, 0, rows - 1)
    .line("right", cols - 1, 0, cols - 1, rows - 1);
}

/** The Mac's window: its bar on top, and its panes as rows of who sits in each. More than two get the tab strip. */
function windowOf(box: Box, panes: readonly (readonly number[])[]): Shape {
  const { cols, rows } = box;
  const sheet = outlined(box, 2).write("knob", 2, 1, "• • •", HAIR);
  const count = panes.flat().length;
  // A tab is named for its focused Cell and counts its panes, as the app's does.
  if (count > 2)
    sheet
      .write("words", 10, 1, `${CREW[0][0]} · ${count}`, INK)
      .write("words", 23, 1, "New Cell", QUIET)
      .write("words", 34, 1, "+", QUIET);
  const seats: (Seat | undefined)[] = CREW.map(() => undefined);
  panes.forEach((row, j) => {
    const r0 = cut(j, panes.length, 2, rows - 1),
      r1 = cut(j + 1, panes.length, 2, rows - 1);
    row.forEach((who, i) => {
      const c0 = cut(i, row.length, 0, cols - 1),
        c1 = cut(i + 1, row.length, 0, cols - 1);
      if (i > 0) sheet.line("split", c0, r0, c0, r1);
      if (j > 0) sheet.line("split", c0, r0, c1, r0);
      seats[who] = chat(sheet, box, who, c0 + 1, r0 + 1, c1 - c0 - 1, r1 - r0 - 1, 11);
    });
  });
  return sheet.shape(box, seats);
}

/** The phone: a tall outline, the chats of `order` sharing its screen, the four stages as the tabs at its foot. */
function phoneOf(box: Box, order: readonly number[]): Shape {
  const { cols, rows } = box;
  const sheet = outlined(box, rows - 3).write("knob", Math.floor(cols / 2) - 3, 1, "▀▀▀▀▀▀", HAIR);
  let c = 1 + Math.floor((cols - 2 - STAGES.join(" ").length) / 2);
  for (const stage of STAGES) {
    // Every chat on it is at work: the Flying tab is the open one.
    sheet.write("words", c, rows - 2, stage, stage === "Flying" ? INK : QUIET);
    c += stage.length + 1;
  }
  const seats: (Seat | undefined)[] = CREW.map(() => undefined);
  order.forEach((who, n) => {
    const r0 = cut(n, order.length, 2, rows - 3),
      r1 = cut(n + 1, order.length, 2, rows - 3);
    seats[who] = chat(sheet, box, who, 1, r0, cols - 2, r1 - r0, 6);
  });
  return sheet.shape(box, seats);
}

const placeOf = (m: Mark): string => `${Math.round(m.x * 4)}|${Math.round(m.y * 4)}`;
const same = (a: Mark, b: Mark): boolean => a.ch === b.ch && a.h === b.h && a.rgb === b.rgb;
const reading = (m: Mark, n: Mark): number => m.y - n.y || m.x - n.x;
const mix = (a: Rgb, b: Rgb, u: number): Rgb => [
  lerp(a[0], b[0], u),
  lerp(a[1], b[1], u),
  lerp(a[2], b[2], u),
];

/** `body` passing in a wave between `from` and `to` of a turn, in reading order, each mark taking `each` of it. */
function wave(body: Body, from: number, to: number, each: number): Passing[] {
  const order = [...body].sort(reading);
  return order.map((m, n) => {
    const starts = lerp(from, to - each, n / Math.max(1, order.length - 1));
    return [m, starts, starts + each] as const;
  });
}
/** When in a turn what goes has gone, and what comes starts to: the Cells' own stretches. */
const GONE = 0.45,
  COMES = 0.55;

/** A joint's line without its branch, for the stretch where what it joined is on its way. */
const plain = (ch: string): string => ("├┤".includes(ch) ? "│" : "┬┴┼".includes(ch) ? "─" : ch);

/**
 * A line sliding onto its next self: its ends travel, and it is drawn between
 * them a cell a step, so it is one unbroken line all the way. A joint's
 * branch goes as what it joined goes, and comes as it comes.
 */
function slide(g: Glyphs, was: Body, is: Body, u: number): void {
  const e = ease.inOut(u),
    turned = span(e, 0.3, 0.7);
  const x0 = lerp(was[0]!.x, is[0]!.x, e),
    y0 = lerp(was[0]!.y, is[0]!.y, e),
    x1 = lerp(was.at(-1)!.x, is.at(-1)!.x, e),
    y1 = lerp(was.at(-1)!.y, is.at(-1)!.y, e);
  const h = lerp(was[0]!.h, is[0]!.h, e);
  const flat = Math.abs(is.at(-1)!.x - is[0]!.x) >= Math.abs(is.at(-1)!.y - is[0]!.y);
  const steps = Math.ceil(Math.hypot(x1 - x0, y1 - y0) / (flat ? h / 2 : h) - 0.01);
  const put = (a: Mark, b: Mark, along: number, joint: boolean): void => {
    const x = lerp(x0, x1, along),
      y = lerp(y0, y1, along),
      alpha = lerp(a.a, b.a, e),
      rgb = mix(a.rgb, b.rgb, e);
    if (a.ch === b.ch) g.put(a.ch, x, y, h, rgb, alpha);
    else if (plain(a.ch) !== plain(b.ch)) {
      g.put(a.ch, x, y, h, rgb, alpha * (1 - turned));
      g.put(b.ch, x, y, h, rgb, alpha * turned);
    } else {
      if (!joint) g.put(plain(a.ch), x, y, h, rgb, alpha);
      if (a.ch !== plain(a.ch)) g.put(a.ch, x, y, h, rgb, alpha * (1 - span(u, 0, GONE)));
      if (b.ch !== plain(b.ch)) g.put(b.ch, x, y, h, rgb, alpha * span(u, COMES, 1));
    }
  };
  // The run between the ends is the line's own character; its joints ride where they stood along it.
  const inner = (body: Body): Mark => {
    const m = body[Math.min(1, body.length - 1)]!;
    return { ...m, ch: plain(m.ch) };
  };
  // Measured, not counted: where another line keeps the joint, this one has no mark.
  const along = (body: Body, m: Mark): number => {
    const from = body[0]!,
      to = body.at(-1)!;
    const length = Math.hypot(to.x - from.x, to.y - from.y);
    return length === 0 ? 0 : Math.hypot(m.x - from.x, m.y - from.y) / length;
  };
  for (let n = 1; n < steps; n++) put(inner(was), inner(is), n / steps, false);
  put(was[0]!, is[0]!, 0, false);
  if (steps > 0) put(was.at(-1)!, is.at(-1)!, 1, false);
  for (const [body, other] of [
    [was, is],
    [is, was],
  ] as const)
    body.forEach((m, n) => {
      if (n === 0 || n === body.length - 1 || m.ch === plain(m.ch)) return;
      const line = inner(other);
      put(body === was ? m : line, body === was ? line : m, along(body, m), true);
    });
}

/**
 * A block of text moving onto another, mark for mark in reading order and all
 * together, so its lines stay lines on the way and its words turn in formation.
 */
function reflow(g: Glyphs, was: Body, is: Body, u: number): void {
  const e = ease.inOut(u),
    turned = span(e, 0.3, 0.7);
  const count = Math.max(was.length, is.length);
  for (let k = 0; k < count; k++) {
    const a = was[Math.floor((k * was.length) / count)]!,
      b = is[Math.floor((k * is.length) / count)]!;
    const x = lerp(a.x, b.x, e),
      y = lerp(a.y, b.y, e),
      h = lerp(a.h, b.h, e),
      rgb = mix(a.rgb, b.rgb, e);
    if (a.ch === b.ch) g.put(a.ch, x, y, h, rgb, lerp(a.a, b.a, e));
    else {
      g.put(a.ch, x, y, h, rgb, a.a * (1 - turned));
      g.put(b.ch, x, y, h, rgb, b.a * turned);
    }
  }
}

/**
 * A shape dividing within the same outline: a divider draws down the middle
 * and the newcomer comes into the half that opened. Nothing travels, so every
 * moment on the way is a window one could have.
 */
function divided(a: Shape, b: Shape): Turn {
  const comes = new Set(
    b.seats.flatMap((seat, who) =>
      seat === undefined || a.seats[who] !== undefined
        ? []
        : ["ground", "name", "said"].flatMap((part) => b.parts.get(`${part}${who}`) ?? []),
    ),
  );
  const next = new Map(
    [...b.parts.values()]
      .flat()
      .filter((m) => !comes.has(m))
      .map((m) => [placeOf(m), m]),
  );
  const drawn = new Set(b.parts.get("split"));
  const still: Mark[] = [],
    swaps: (readonly [Mark, Mark])[] = [],
    gone: Mark[] = [];
  const met = new Set<Mark>();
  for (const m of [...a.parts.values()].flat()) {
    const there = next.get(placeOf(m));
    if (there !== undefined && same(m, there)) {
      met.add(there);
      still.push(m);
    } else if (there !== undefined && m.rgb === HAIR && there.rgb === HAIR) {
      // A hairline a divider now meets: it stays, and the joint is drawn over it with the divider.
      drawn.add(there);
      still.push(m);
    } else if (there !== undefined && !drawn.has(there)) {
      met.add(there);
      swaps.push([m, there]);
    } else gone.push(m);
  }
  return {
    still,
    swaps,
    rides: [],
    lines: [],
    blocks: [],
    enters: [
      ...wave([...drawn], 0.05, 0.6, 0.15),
      ...wave(
        [...b.parts.values()].flat().filter((m) => !met.has(m) && !drawn.has(m)),
        COMES,
        1,
        0.2,
      ),
    ],
    leaves: wave(gone, 0, GONE, 0.2),
  };
}

/** `body` not yet there, or no longer: what slides out of it comes into sight on the way, what slides into it goes. */
const unseen = (body: Body): Mark[] => body.map((m) => ({ ...m, a: 0 }));

/** The side of its outline a shape's bar lies along: a window's along its top, a phone's along its foot. */
function barSide(shape: Shape): "top" | "bottom" {
  const y = (part: string): number => shape.parts.get(part)?.[0]?.y ?? 0;
  return y("bar") - y("top") <= y("bottom") - y("bar") ? "top" : "bottom";
}

/**
 * A shape becoming one with another outline: each side slides onto the same
 * side, a bar onto its bar, and a Cell that stays takes its name, its ground
 * and its lines along.
 */
function reshaped(a: Shape, b: Shape): Turn {
  const rides: (readonly [Mark, Mark])[] = [],
    lines: (readonly [Body, Body])[] = [],
    blocks: (readonly [Body, Body])[] = [],
    enters: Mark[] = [],
    leaves: Mark[] = [];
  const turn = (part: string, line = false): void => {
    const was = a.parts.get(part) ?? [],
      is = b.parts.get(part) ?? [];
    if (was.length === 0) enters.push(...is);
    else if (is.length === 0) leaves.push(...was);
    else if (was.length === is.length && was.every((m, n) => m.ch === is[n]!.ch))
      was.forEach((m, n) => rides.push([m, is[n]!]));
    else (line ? lines : blocks).push([was, is]);
  };
  for (const part of ["top", "bottom", "left", "right", "split"]) turn(part, true);
  const bar = a.parts.get("bar") ?? [],
    next = b.parts.get("bar") ?? [];
  if (barSide(a) === barSide(b) || bar.length === 0 || next.length === 0) {
    turn("bar", true);
    turn("words");
  } else {
    lines.push([bar, unseen(b.parts.get(barSide(a))!)], [unseen(a.parts.get(barSide(b))!), next]);
    leaves.push(...(a.parts.get("words") ?? []));
    enters.push(...(b.parts.get("words") ?? []));
  }
  turn("knob");
  CREW.forEach((_, who) => {
    for (const part of ["name", "ground", "said"]) turn(`${part}${who}`);
  });
  return {
    still: [],
    swaps: [],
    rides,
    lines,
    blocks,
    // What only one of the two has goes before the outline has moved far, and comes once it is nearly there.
    enters: wave(enters, 0.78, 1, 0.15),
    leaves: wave(leaves, 0, 0.32, 0.15),
  };
}

const told = (minutes: number): string =>
  minutes < 60
    ? `${minutes} min`
    : minutes % 60 === 0
      ? `${minutes / 60} h`
      : `${Math.floor(minutes / 60)} h ${minutes % 60} min`;

/** The scene laid out for one box: the growing Cell's place and meter, and the app's shapes in order. */
interface Plan {
  /** False when the box is too small to stage any of it: then only the lines are said. */
  readonly fits: boolean;
  readonly d: number;
  readonly big: Seat;
  readonly bar: number;
  readonly ground: Body;
  readonly meter: (filled: number, minutes: number) => Mark[];
  readonly shapes: readonly Shape[];
  readonly turns: readonly Turn[];
}

function lay(f: SceneFrame): Plan {
  const { art, form } = f;
  const phone = form === "phone";
  const h = phone ? 14 : 16,
    w = h / 2;
  const colsFit = Math.floor(art.width / w),
    rowsFit = Math.floor(art.height / h);
  // A tablet held upright has the height for panes stacked two by two.
  const upright = form === "tablet" && art.height >= 640;
  const small = phone && rowsFit < 26 ? 1 : 2;
  // `share` is the rows of the smallest share the box is ever cut into: air only where that has them.
  const box = (cols: number, rows: number, share: number, inset = 2): Box => ({
    x: Math.round(art.x + (art.width - cols * w) / 2),
    y: Math.round(art.y + (art.height - rows * h) / 2),
    cols,
    rows,
    h,
    small,
    inset,
    air: share > headed(h, small) + 3 ? 1 : 0,
  });
  const listed = (rows: number, chats: number): number => Math.floor((rows - 5) / chats),
    stacked = (rows: number): number => Math.floor((rows - 3) / 2) - 1;

  // As large as the box takes with room for its ground and meter: whole CSS pixels an art pixel.
  const roomy = phone ? art.height >= 420 : art.width >= 700 && art.height >= 600;
  const px = Math.max(
    2,
    Math.min((phone ? 4 : 5) + (roomy ? 1 : 0), Math.floor((art.height - h * 3) / ABOVE)),
  );
  const bar = phone ? 8 : 12;
  const cx = Math.round(art.x + art.width * (form === "desk" ? 0.46 : 0.5));
  const stands = ABOVE * px + FEET + h * 2.75;
  const big: Seat = { x: cx, y: Math.round(art.y + (art.height - stands) / 2 + ABOVE * px), px };
  const reach = Math.ceil(((ACROSS / 2) * px + w * 2) / w);
  const ground: Mark[] = [];
  for (let n = -reach; n <= reach; n++)
    ground.push({ x: cx + n * w, y: big.y + FEET, ch: "·", h, rgb: QUIET, a: 1 });
  const top = big.y + FEET + h * 1.25,
    from = cx - (bar * w) / 2;
  const meter = (filled: number, minutes: number): Mark[] => [
    ...textBody("alone", { x: from - 6 * w, y: top, h, rgb: QUIET }),
    ...textBody(`${"█".repeat(filled)}${"░".repeat(bar - filled)} ${told(minutes)}`, {
      x: from,
      y: top,
      h,
    }),
  ];
  // The ground becomes the outline's foot, and the rest of the outline rises out of it;
  // the meter is its words: said, and gone before the outline has opened far.
  const first: Shape = {
    seats: [big],
    parts: new Map([
      ["bottom", ground],
      ["top", unseen(ground)],
      ["bar", unseen(ground)],
      ["left", unseen(ground.slice(0, 1))],
      ["right", unseen(ground.slice(-1))],
      ["words", meter(bar, 120)],
    ]),
  };

  let shapes: Shape[];
  if (phone) {
    const tall = Math.max(17, Math.min(31, rowsFit - 1)),
      wide = Math.max(12, Math.min(23, rowsFit - 1));
    const pocket = box(31, tall, listed(tall, CREW.length));
    const mac = box(colsFit - ((colsFit + 1) % 2), wide, stacked(wide));
    shapes = [
      first,
      phoneOf(pocket, [0]),
      phoneOf(pocket, [0, 1]),
      phoneOf(pocket, [0, 2, 1, 3]),
      windowOf(mac, [
        [0, 2],
        [1, 3],
      ]),
    ];
  } else {
    const cols = Math.min(84, colsFit - 2);
    // Four panes abreast want a wide window; a narrower one stacks them two by two.
    const abreast = !upright && cols >= 80;
    const rows = Math.max(12, Math.min(upright ? 34 : abreast ? 18 : 26, rowsFit - 2));
    const mac = box(cols, rows, abreast ? rows - 4 : stacked(rows), abreast && cols < 84 ? 1 : 2);
    const tall = Math.max(14, Math.min(33, rowsFit - 2));
    // A pane divides in two, and the newcomer takes the half that opens: no one changes places.
    const crowd = abreast
      ? [[0, 2, 1, 3]]
      : [
          [0, 1],
          [2, 3],
        ];
    shapes = [
      first,
      windowOf(mac, [[0]]),
      windowOf(mac, [[0, 1]]),
      windowOf(mac, crowd),
      phoneOf(box(31, tall, listed(tall, 1)), [0]),
    ];
  }
  return {
    fits: art.height >= (phone ? 252 : 230) && art.width >= 31 * w,
    d: density(),
    big,
    bar,
    ground,
    meter,
    shapes,
    turns: shapes
      .slice(1)
      .map((shape, n) =>
        n === 0 || n === 3 ? reshaped(shapes[n]!, shape) : divided(shapes[n]!, shape),
      ),
  };
}

export function becomes(root: HTMLElement): void {
  const cells = layerIn(root, "cells");
  const glyphs = new Glyphs(layerIn(root, "glyphs"));
  const context = cells.getContext("2d")!;
  const beat = root.querySelector<HTMLElement>(".beat")!;
  // One deal for the whole scene, so the Cell that grew is the Cell in the first pane.
  const cast: Cell[] = crew(CREW);
  const otter = cast[0]!;
  const grownTo = (look: CellLook) => ({ ...otter, look });
  const tiers = TIERS.map(({ strength }) =>
    grownTo(grown(otter.look, strength, strength === "biceps")),
  );
  const panes = [grownTo(grown(otter.look, "biceps")), ...cast.slice(1)];
  let plan: Plan | null = null;
  let saying = "";

  /** The Cell as its new strength lands: the app's own springs, read off the story. */
  const bouncing = (look: CellLook, since: number, points: number): MiniFrame =>
    tossFrame(
      look,
      {
        held: false,
        vx: 0,
        vy: 0,
        grounded: true,
        hits: [{ surface: "floor", speed: HIT, at: 0 }],
      },
      since * BOUNCE_MS,
      points,
    );

  /** The flex: crouch and arms up as the story reaches it, held while it stays, down as it leaves. */
  const flexing = (p: number, t: number): MiniFrame => {
    const flex = sceneOf(tiers[3]!.look, "happy")!.mini;
    const up = span(p, TIERS[3]!.at + BOUNCE, TIERS[3]!.at + BOUNCE + RAISE),
      down = span(p, TURNS[0][0] - LOWER, TURNS[0][0]);
    if (down > 0) return flex[Math.min(14, 11 + Math.floor(down * 4))]!;
    if (up < 1) return flex[Math.floor(up * 5)]!;
    // Held, its sparkle comes round every second and a half.
    return flex[5 + Math.min(5, Math.floor(t * 12) % 18)]!;
  };

  const grow = (p: number, t: number, plan: Plan): void => {
    const n = TIERS.findLastIndex((tier) => p >= tier.at);
    const tier = TIERS[n]!,
      next = TIERS[n + 1];
    const filling = next === undefined ? 0 : span(p, next.at - FILL, next.at);
    const level = (at: number) => ((at + 1) * plan.bar) / TIERS.length;
    drawBody(glyphs, plan.ground);
    drawBody(
      glyphs,
      plan.meter(
        Math.round(lerp(level(n), level(n + 1), filling)),
        Math.round(lerp(tier.minutes, next?.minutes ?? tier.minutes, filling)),
      ),
    );
    const cell = tiers[n]!;
    const since = (p - tier.at) / BOUNCE;
    const frame =
      n > 0 && since < 1
        ? bouncing(cell.look, since, plan.big.px * 2)
        : n === 3
          ? flexing(p, t)
          : frameAt(cell, tier.doing, t);
    drawCell(context, cell, frame, {
      x: plan.big.x * plan.d,
      y: plan.big.y * plan.d,
      px: Math.round(plan.big.px * plan.d),
    });
  };

  const shape = (p: number, t: number, k: number, plan: Plan): void => {
    const [from, to] = TURNS[k]!;
    const u = span(p, from, to),
      e = ease.inOut(u);
    const turn = plan.turns[k]!,
      a = plan.shapes[k]!,
      b = plan.shapes[k + 1]!;
    drawBody(glyphs, turn.still);
    for (const [was, is] of turn.swaps) {
      glyphs.put(was.ch, was.x, was.y, was.h, was.rgb, was.a * (1 - e));
      glyphs.put(is.ch, is.x, is.y, is.h, is.rgb, is.a * e);
    }
    for (const [was, is] of turn.rides)
      glyphs.put(
        is.ch,
        lerp(was.x, is.x, e),
        lerp(was.y, is.y, e),
        lerp(was.h, is.h, e),
        is.rgb,
        is.a,
      );
    for (const [was, is] of turn.lines) slide(glyphs, was, is, u);
    for (const [was, is] of turn.blocks) reflow(glyphs, was, is, u);
    for (const [m, from, to] of turn.leaves)
      glyphs.put(m.ch, m.x, m.y, m.h, m.rgb, m.a * (1 - span(u, from, to)));
    for (const [m, from, to] of turn.enters)
      glyphs.put(m.ch, m.x, m.y, m.h, m.rgb, m.a * span(u, from, to));
    panes.forEach((cell, n) => {
      const here = a.seats[n],
        there = b.seats[n];
      const seat = there ?? here;
      if (seat === undefined) return;
      const moves = here !== undefined && there !== undefined;
      // A newcomer comes into sight as its pane arrives; one that leaves goes as its pane does.
      const alpha = moves ? 1 : there === undefined ? 1 - span(u, 0, GONE) : span(u, COMES, 1);
      drawCell(context, cell, frameAt(cell, WORK[n]!, t + n * 0.7), {
        x: (moves ? lerp(here.x, there.x, e) : seat.x) * plan.d,
        y: (moves ? lerp(here.y, there.y, e) : seat.y) * plan.d,
        px: Math.max(1, Math.round((moves ? lerp(here.px, there.px, e) : seat.px) * plan.d)),
        alpha,
      });
    });
  };

  scene(
    root,
    (f) => {
      glyphs.size(f.width, f.height);
      if (f.fresh || plan === null) {
        plan = lay(f);
        const width = Math.round(f.width * plan.d),
          height = Math.round(f.height * plan.d);
        if (cells.width !== width || cells.height !== height) {
          cells.width = width;
          cells.height = height;
        }
        cells.style.width = `${f.width}px`;
        cells.style.height = `${f.height}px`;
      }
      glyphs.clear();
      context.clearRect(0, 0, cells.width, cells.height);
      const k = TURNS.findLastIndex(([from]) => f.p >= from);
      if (plan.fits) {
        if (k < 0) grow(f.p, f.t, plan);
        else shape(f.p, f.t, k, plan);
      }
      glyphs.flush();

      const turned = TURNS.findLastIndex(([from, to]) => f.p >= (from + to) / 2);
      const said =
        turned < 0
          ? TIERS.findLast((tier) => f.p >= tier.at)!.beat
          : SHAPED[f.form === "phone" ? "phone" : "desk"][turned]!;
      if (said !== saying) beat.textContent = saying = said;
    },
    { still: 0.85 },
  );
}
