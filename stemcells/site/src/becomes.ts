// The third scene: it becomes what you need. A Cell grows with the time it
// works alone, at the app's own marks (`cell/growth.ts`). Then the app, drawn
// solid: one chat, two side by side, a crew in tabs and panes, a phone. A
// phone is shown its own shape first and ends on the Mac.

import {
  type CellLook,
  grown,
  type MiniFrame,
  sceneOf,
  type Strength,
  tossFrame,
} from "./app-cells.ts";
import { BELOW, type Cell, crew, drawCell, frameAt } from "./cells.ts";
import { clamp, density, ease, hash, lerp, span } from "./kit/form.ts";
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
/** The minutes alone that grow a strength: the meter's ticks, a third of its track apart. */
const MARKS = TIERS.slice(1).map((tier) => tier.minutes);
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
/** Every chat shown is at work: the open tab of the phone. */
const OPEN = "Flying";
/** The tab strip after the open tab: a second tab, and the button for one more. */
const TABS = ["New Cell", "+"] as const;

/** The solid look: a raised surface on the night, ink, and the page's monospace. */
const RAISED = "#151514",
  PAGE = "#0B0B0C",
  MONO = 'ui-monospace, "SF Mono", SFMono-Regular, Menlo, Consolas, monospace';
const ink = (alpha: number): string => `rgba(237, 233, 224, ${alpha})`;
const type = (size: number, bold = false): string => `${bold ? "700 " : ""}${size}px ${MONO}`;
/** A hairline: ink at 0.22 on the raised surface, as a colour, so two that cross stay one hairline's grey. */
const HAIR = "#454441";
/** The open tab's fill: the raised surface, a little brighter. */
const LIFTED = "#222220";
/** The ground's dots, the one part still made of characters. */
const QUIET: Rgb = [
  lerp(NIGHT[0], INK[0], 0.55),
  lerp(NIGHT[1], INK[1], 0.55),
  lerp(NIGHT[2], INK[2], 0.55),
];
/** What a chat has said: a paragraph's lines as shares of its width; 0 is the gap between two. */
const SAID = [0.95, 0.8, 0.5, 0, 0.9, 0.6, 0, 1, 0.75, 0.45] as const;
/** The ground's dots sit this far under a Cell's feet, CSS pixels. */
const FEET = 3;
/** A Cell's art above its feet and across, art pixels. */
const ABOVE = 30,
  ACROSS = 34;

/** When in a turn a pane has made room, a divider draws, and a newcomer comes into sight. */
const ROOM = [0, 0.4],
  DRAWN = [0.28, 0.68],
  COMES = [0.6, 1];
/** When in a turn between two outlines the first one's insides have gone, and the next one's come. */
const GONE = [0, 0.25],
  LANDS = [0.75, 1];
/** When in the first turn the app's outline fades up, growing to its size from this share of it. */
const RISES = [0.15, 0.75],
  SMALL = 0.96;
/** How much of that turn the Cells take to stack into the phone's list, counted from the window's end of it. */
const STACKS = 0.6;

interface Rect {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}
interface Outline extends Rect {
  readonly r: number;
}
/** A hairline from a point, along a row or down a column. */
interface Rule {
  readonly x: number;
  readonly y: number;
  readonly length: number;
  readonly down: boolean;
}
/** Where a Cell stands: its feet, CSS pixels, and CSS pixels an art pixel. */
interface Seat {
  readonly x: number;
  readonly y: number;
  readonly px: number;
}
/** What a thing's parts measure, CSS pixels, by how large its Cells stand. */
interface Metrics {
  readonly px: 1 | 2 | 3;
  readonly inset: number;
  /** A name's type, and the fine print's. */
  readonly type: number;
  readonly fine: number;
  /** A message bar's height: the gap to the next, too. */
  readonly bar: number;
  /** How tall the bar along the top is, the phone's tabs are, and a composer is. */
  readonly head: number;
  readonly foot: number;
  readonly composer: number;
  /** The widest a chat's lines run. */
  readonly column: number;
  /** The narrowest phone that fits the four stages, and the tallest one drawn beside a window. */
  readonly pocket: readonly [narrowest: number, tallest: number];
  /** The smallest pane a chat this size fits, and the height that holds one paragraph of it and no more. */
  readonly pane: readonly [narrowest: number, shortest: number, snug: number];
}
const METRICS: readonly Metrics[] = [
  {
    px: 1,
    inset: 10,
    type: 11,
    fine: 10,
    bar: 5,
    head: 26,
    foot: 32,
    composer: 20,
    column: 240,
    pocket: [188, 300],
    pane: [0, 0, 112],
  },
  {
    px: 2,
    inset: 16,
    type: 13,
    fine: 11,
    bar: 8,
    head: 36,
    foot: 44,
    composer: 28,
    column: 400,
    pocket: [212, 520],
    pane: [150, 160, 188],
  },
  {
    px: 3,
    inset: 20,
    type: 15,
    fine: 13,
    bar: 10,
    head: 44,
    foot: 54,
    composer: 34,
    column: 520,
    pocket: [252, 640],
    pane: [216, 270, 250],
  },
];

/**
 * One shape the app takes: its outline, each of the crew's share of it (a pane,
 * or a row of the phone's list) if it has one, and the hairlines between them.
 */
interface Shape {
  readonly kind: "window" | "phone";
  readonly frame: Outline;
  readonly rooms: readonly (Rect | undefined)[];
  readonly rules: readonly Rule[];
  /** How many panes its tab counts; 0 while it has no tab strip. */
  readonly tabs: number;
}

/** The Mac's window: a bar along its top, and its panes as rows of who sits in each. More than two get the tab strip. */
function windowOf(at: Rect, panes: readonly (readonly number[])[], m: Metrics): Shape {
  const top = at.y + m.head,
    across = panes[0]!.length,
    count = panes.length * across;
  const xs = (i: number): number => at.x + Math.round((i * at.w) / across),
    ys = (j: number): number => top + Math.round((j * (at.h - m.head)) / panes.length);
  const rooms: (Rect | undefined)[] = CREW.map(() => undefined);
  panes.forEach((row, j) =>
    row.forEach((who, i) => {
      rooms[who] = { x: xs(i), y: ys(j), w: xs(i + 1) - xs(i), h: ys(j + 1) - ys(j) };
    }),
  );
  const rules: Rule[] = [];
  for (let i = 1; i < across; i++)
    rules.push({ x: xs(i), y: top + 1, length: at.h - m.head - 2, down: true });
  for (let j = 1; j < panes.length; j++)
    rules.push({ x: at.x + 1, y: ys(j), length: at.w - 2, down: false });
  // A tab is named for its focused Cell and counts its panes, as the app's does.
  return { kind: "window", frame: { ...at, r: 12 }, rooms, rules, tabs: count > 2 ? count : 0 };
}

/** The phone: a tall outline, the Cells of `order` listed down its screen, the four stages as the tabs at its foot. */
function phoneOf(at: Rect, order: readonly number[], m: Metrics): Shape {
  const row = Math.floor((at.h - m.head - m.foot) / CREW.length);
  const rooms: (Rect | undefined)[] = CREW.map(() => undefined);
  order.forEach((who, n) => {
    rooms[who] = { x: at.x, y: at.y + m.head + n * row, w: at.w, h: row };
  });
  const rules = order.slice(1).map((_, n) => ({
    x: at.x + m.inset,
    y: at.y + m.head + (n + 1) * row,
    length: at.w - 2 * m.inset,
    down: false,
  }));
  return {
    kind: "phone",
    frame: { ...at, r: Math.min(28, Math.round(at.w * 0.12)) },
    rooms,
    rules,
    tabs: 0,
  };
}

/** Where a Cell stands in its share: at the head of a pane, halfway down a row of the list. */
const seatOf = (shape: Shape, room: Rect, m: Metrics): Seat => ({
  x: room.x + m.inset + (ACROSS / 2) * m.px,
  y:
    shape.kind === "window"
      ? room.y + Math.round(m.inset * 0.75) + ABOVE * m.px
      : room.y + Math.round((room.h + (ABOVE - BELOW) * m.px) / 2),
  px: m.px,
});

const between = (a: Rect, b: Rect, u: number): Rect => ({
  x: lerp(a.x, b.x, u),
  y: lerp(a.y, b.y, u),
  w: lerp(a.w, b.w, u),
  h: lerp(a.h, b.h, u),
});
/** `rect` of the outline `from`, where it falls once that outline has become `to`. */
const carried = (rect: Rect, from: Rect, to: Rect): Rect => ({
  x: to.x + ((rect.x - from.x) * to.w) / from.w,
  y: to.y + ((rect.y - from.y) * to.h) / from.h,
  w: (rect.w * to.w) / from.w,
  h: (rect.h * to.h) / from.h,
});

type Pen = CanvasRenderingContext2D;

/** A surface: the raised fill inside one hairline, on whole pixels. */
function plate(c: Pen, at: Outline, alpha: number, fill = RAISED): void {
  if (alpha <= 0 || at.w < 2 || at.h < 2) return;
  c.globalAlpha = alpha;
  c.beginPath();
  c.roundRect(at.x + 0.5, at.y + 0.5, at.w - 1, at.h - 1, Math.min(at.r, at.w / 2, at.h / 2));
  c.fillStyle = fill;
  c.fill();
  c.lineWidth = 1;
  c.strokeStyle = HAIR;
  c.stroke();
}

/** A hairline, as far as it is `drawn`. */
function rule(c: Pen, at: Rule, alpha: number, drawn = 1): void {
  if (alpha <= 0 || drawn <= 0) return;
  c.globalAlpha = alpha;
  c.fillStyle = HAIR;
  if (at.down) c.fillRect(at.x, at.y, 1, at.length * drawn);
  else c.fillRect(at.x, at.y, at.length * drawn, 1);
}

/** A bar of ink with round ends: a line someone wrote. */
function bar(c: Pen, at: Rect, shade: number, alpha: number): void {
  if (alpha <= 0 || at.w <= 0) return;
  c.globalAlpha = alpha;
  c.beginPath();
  c.roundRect(at.x, at.y, at.w, at.h, Math.min(at.h, at.w) / 2);
  c.fillStyle = ink(shade);
  c.fill();
}

/** How wide `text` stands at `size`: the pen keeps that type. */
function measured(c: Pen, text: string, size: number, bold = false): number {
  c.font = type(size, bold);
  return c.measureText(text).width;
}

/** `text` from `x`, its middle on `y`. */
function write(
  c: Pen,
  text: string,
  x: number,
  y: number,
  size: number,
  shade: number,
  alpha: number,
  bold = false,
): void {
  if (alpha <= 0) return;
  c.font = type(size, bold);
  c.textBaseline = "middle";
  c.globalAlpha = alpha;
  c.fillStyle = ink(shade);
  c.fillText(text, x, y + size * 0.04);
}

/** A Cell's name beside it, and under the name the line it is on, as long as a share `wide` leaves room for. */
function named(c: Pen, who: number, seat: Seat, wide: number, m: Metrics, alpha: number): void {
  const reach = (ACROSS / 2) * m.px,
    x = seat.x + reach + m.bar + 2;
  write(c, CREW[who]![0], x, seat.y - 15 * m.px, m.type, 1, alpha, true);
  const room = Math.min(seat.x - reach + wide - m.inset * 2 - x, m.type * 8);
  const long = Math.round(room * (0.6 + 0.4 * hash(who, 9)));
  bar(c, { x, y: seat.y - 9 * m.px, w: long, h: m.bar - 2 }, 0.16, alpha);
}

/**
 * A pane's chat under its Cell: what was said as bars, as far down as the
 * composer at its foot leaves room. A bar the composer nears fades, so a pane
 * that is made shorter loses its last lines smoothly.
 */
function chat(c: Pen, who: number, room: Rect, m: Metrics, alpha: number): void {
  if (alpha <= 0) return;
  const edge = Math.round(m.inset * 0.75);
  const left = room.x + m.inset,
    width = room.w - 2 * m.inset,
    foot = room.y + room.h - edge - m.composer;
  plate(c, { x: left, y: foot, w: width, h: m.composer, r: 8 }, alpha, PAGE);
  c.globalAlpha = alpha;
  c.beginPath();
  c.arc(left + width - m.composer / 2, foot + m.composer / 2, m.composer * 0.16, 0, Math.PI * 2);
  c.fillStyle = ink(0.42);
  c.fill();
  const reach = Math.min(width, m.column);
  let y = room.y + edge + (ABOVE + BELOW) * m.px + Math.round(m.bar * 1.75);
  SAID.forEach((share, n) => {
    if (share > 0) {
      const long = Math.round(reach * share * (0.8 + 0.2 * hash(n, who + 3)));
      const spare = foot - m.bar * 1.5 - (y + m.bar);
      bar(c, { x: left, y, w: long, h: m.bar }, 0.13, alpha * span(spare, 0, m.bar));
    }
    y += share > 0 ? m.bar * 2 : m.bar;
  });
}

/** The window's bar: three knobs, and its tabs once it has them, `tabbed` of the way slid in. */
function titled(c: Pen, at: Rect, m: Metrics, alpha: number, tabs: number, tabbed: number): void {
  if (alpha <= 0) return;
  const mid = at.y + m.head / 2,
    knob = Math.round(m.head / 9);
  c.globalAlpha = alpha;
  c.lineWidth = 1;
  c.strokeStyle = ink(0.42);
  for (let n = 0; n < 3; n++) {
    c.beginPath();
    c.arc(at.x + m.inset + knob + n * knob * 3.5, mid, knob - 0.5, 0, Math.PI * 2);
    c.stroke();
  }
  if (tabs === 0 || tabbed <= 0) return;
  const high = m.head - Math.round(m.inset * 0.75),
    pad = Math.round(m.fine * 0.9);
  let x = at.x + m.inset * 2 + knob * 9 + lerp(-m.inset, 0, ease.out(tabbed));
  [`${CREW[0][0]} · ${tabs}`, ...TABS].forEach((tab, n) => {
    const wide = Math.round(measured(c, tab, m.fine)) + pad * 2;
    if (n === 0) plate(c, { x, y: mid - high / 2, w: wide, h: high, r: 8 }, alpha * tabbed, LIFTED);
    write(c, tab, x + pad, mid, m.fine, n === 0 ? 1 : 0.42, alpha * tabbed);
    x += wide + 2;
  });
}

/** The phone's own parts: the pill at its top, and the four stages as tabs along its foot, the open one in ink. */
function pocketed(c: Pen, at: Rect, m: Metrics, alpha: number): void {
  if (alpha <= 0) return;
  const pill = { w: Math.round(at.w * 0.22), h: Math.round(m.head / 3.6) };
  plate(
    c,
    {
      x: Math.round(at.x + (at.w - pill.w) / 2),
      y: Math.round(at.y + (m.head - pill.h) / 2),
      ...pill,
      r: pill.h,
    },
    alpha,
    PAGE,
  );
  rule(c, { x: at.x + 1, y: at.y + at.h - m.foot, length: at.w - 2, down: false }, alpha);
  const wide = STAGES.map((stage) => measured(c, stage, m.fine));
  const gap = (at.w - m.inset * 2 - wide.reduce((a, b) => a + b, 0)) / (STAGES.length - 1);
  let x = at.x + m.inset;
  STAGES.forEach((stage, n) => {
    const open = stage === OPEN;
    write(c, stage, x, at.y + at.h - m.foot / 2, m.fine, open ? 1 : 0.42, alpha, open);
    x += wide[n]! + gap;
  });
}

/** How far along the meter's track `minutes` alone reach: each stretch between two marks is as long. */
function reached(minutes: number): number {
  let from = 0;
  for (const [n, mark] of MARKS.entries()) {
    if (minutes <= mark) return (n + span(minutes, from, mark)) / MARKS.length;
    from = mark;
  }
  return 1;
}

const told = (minutes: number): string =>
  minutes < 60
    ? `${minutes} min`
    : minutes % 60 === 0
      ? `${minutes / 60} h`
      : `${Math.floor(minutes / 60)} h ${minutes % 60} min`;

/** The time alone as a thing: a track that fills with ink, a tick at each strength's mark, lit once passed. */
function meter(c: Pen, at: Rect, minutes: number, alpha: number): void {
  if (alpha <= 0) return;
  const full = reached(minutes);
  plate(c, { ...at, r: at.h / 2 }, alpha);
  c.save();
  c.beginPath();
  c.roundRect(at.x, at.y, at.w, at.h, at.h / 2);
  c.clip();
  c.fillStyle = ink(1);
  c.fillRect(at.x, at.y, at.w * full, at.h);
  c.restore();
  MARKS.forEach((_, n) => {
    const mark = (n + 1) / MARKS.length;
    c.globalAlpha = alpha;
    c.fillStyle = ink(lerp(0.3, 1, span(full, mark - 0.03, mark)));
    c.fillRect(at.x + Math.round(at.w * mark) - 2, at.y + at.h + 4, 2, 4);
  });
  const mid = at.y + at.h / 2;
  write(c, "alone", at.x - 10 - measured(c, "alone", 13), mid, 13, 0.68, alpha);
  write(c, told(Math.round(minutes)), at.x + at.w + 10, mid, 13, 1, alpha);
}

/** The scene laid out for one box: the growing Cell's place and meter, and the app's shapes in order. */
interface Plan {
  /** False when the box is too small to stage any of it: then only the lines are said. */
  readonly fits: boolean;
  readonly d: number;
  readonly m: Metrics;
  readonly big: Seat;
  /** The ground's dots: where each stands, and their cell's height. */
  readonly dots: readonly number[];
  readonly h: number;
  readonly meter: Rect;
  readonly shapes: readonly Shape[];
}

function lay(f: SceneFrame): Plan {
  const { art, form } = f;
  const phone = form === "phone";
  const h = phone ? 14 : 16,
    w = h / 2;
  const centred = (wide: number, high: number): Rect => ({
    x: Math.round(art.x + (art.width - wide) / 2),
    y: Math.round(art.y + (art.height - high) / 2),
    w: wide,
    h: high,
  });

  // As large as the box takes with room for its ground and meter: whole CSS pixels an art pixel.
  const roomy = phone ? art.height >= 420 : art.width >= 700 && art.height >= 600;
  const px = Math.max(
    2,
    Math.min((phone ? 4 : 5) + (roomy ? 1 : 0), Math.floor((art.height - h * 3) / ABOVE)),
  );
  const cx = Math.round(art.x + art.width * (form === "desk" ? 0.46 : 0.5));
  const stands = ABOVE * px + FEET + h * 2.75;
  const big: Seat = { x: cx, y: Math.round(art.y + (art.height - stands) / 2 + ABOVE * px), px };
  const reach = Math.ceil(((ACROSS / 2) * px + w * 2) / w);
  const track = phone ? 104 : 144;

  let m: Metrics, shapes: Shape[];
  if (phone) {
    const tall = Math.min(Math.floor(art.height) - 8, 500);
    // The larger Cells, where the list's four rows each hold one and the Mac's panes fit two abreast.
    const large = METRICS[1]!,
      listed = large.head + large.foot + CREW.length * (ABOVE + BELOW) * large.px;
    m = tall >= listed && art.width / 2 >= large.pane[0] ? large : METRICS[0]!;
    const pocket = centred(clamp(Math.round(tall * 0.5), m.pocket[0], Math.floor(art.width)), tall);
    const mac = centred(
      Math.min(Math.floor(art.width), 380),
      Math.min(tall, m.head + 2 * m.pane[2]),
    );
    shapes = [
      phoneOf(pocket, [0], m),
      phoneOf(pocket, [0, 1], m),
      phoneOf(pocket, [0, 1, 2, 3], m),
      windowOf(
        mac,
        [
          [0, 1],
          [2, 3],
        ],
        m,
      ),
    ];
  } else {
    // A box taller than wide has the height for panes stacked two by two; so has a window too narrow for four abreast.
    const upright = art.height >= art.width;
    const wide = Math.min(Math.round(art.width * (upright ? 0.9 : 0.85)), upright ? 700 : 960);
    const abreast = !upright && wide >= 640;
    const high = Math.min(
      Math.floor(art.height) - 24,
      Math.round(wide * (abreast ? 0.66 : upright ? 0.95 : 0.84)),
    );
    const body = high - METRICS[1]!.head;
    const pane = abreast ? [wide / 4, body] : [wide / 2, body / 2];
    // As large as its Cells stand with a whole chat in the smallest pane.
    m = METRICS.findLast(({ pane: [w, h] }) => pane[0]! >= w && pane[1]! >= h)!;
    const mac = centred(wide, high);
    const tall = Math.min(Math.floor(art.height) - 24, m.pocket[1]);
    // A pane divides in two, and the newcomer takes the half that opens: no one changes places.
    const crowd = abreast
      ? [[0, 2, 1, 3]]
      : [
          [0, 1],
          [2, 3],
        ];
    shapes = [
      windowOf(mac, [[0]], m),
      windowOf(mac, [[0, 1]], m),
      windowOf(mac, crowd, m),
      phoneOf(centred(Math.max(Math.round(tall * 0.49), m.pocket[0]), tall), crowd.flat(), m),
    ];
  }
  return {
    fits: art.height >= (phone ? 250 : 240) && art.width >= (phone ? 200 : 320),
    d: density(),
    m,
    big,
    dots: Array.from({ length: reach * 2 + 1 }, (_, n) => cx + (n - reach) * w),
    h,
    meter: { x: cx - track / 2, y: Math.round(big.y + FEET + h * 1.75) - 4, w: track, h: 8 },
    shapes,
  };
}

export function becomes(root: HTMLElement): void {
  const cells = layerIn(root, "cells");
  const things = layerIn(root, "things");
  const glyphs = new Glyphs(layerIn(root, "glyphs"));
  const context = cells.getContext("2d")!;
  const c = things.getContext("2d")!;
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

  const stood = (cell: Cell, frame: MiniFrame, seat: Seat, d: number, alpha = 1): void =>
    drawCell(context, cell, frame, {
      x: seat.x * d,
      y: seat.y * d,
      px: Math.max(1, Math.round(seat.px * d)),
      alpha,
    });
  /** One of the crew at work in its chat. */
  const working = (who: number, seat: Seat, t: number, plan: Plan, alpha = 1): void => {
    const cell = panes[who]!;
    stood(cell, frameAt(cell, WORK[who]!, t + who * 0.7), seat, plan.d, alpha);
  };
  const ground = (plan: Plan, alpha: number): void => {
    for (const x of plan.dots) glyphs.put("·", x, plan.big.y + FEET, plan.h, QUIET, alpha);
  };

  const grow = (p: number, t: number, plan: Plan): void => {
    const n = TIERS.findLastIndex((tier) => p >= tier.at);
    const tier = TIERS[n]!,
      next = TIERS[n + 1];
    const filling = next === undefined ? 0 : span(p, next.at - FILL, next.at);
    ground(plan, 1);
    meter(c, plan.meter, lerp(tier.minutes, next?.minutes ?? tier.minutes, filling), 1);
    const cell = tiers[n]!;
    const since = (p - tier.at) / BOUNCE;
    const frame =
      n > 0 && since < 1
        ? bouncing(cell.look, since, plan.big.px * 2)
        : n === 3
          ? flexing(p, t)
          : frameAt(cell, tier.doing, t);
    stood(cell, frame, plan.big, plan.d);
  };

  /** A shape's outline and what is its own along its edges, its tabs `tabbed` of the way in. */
  const framed = (shape: Shape, at: Outline, m: Metrics, alpha: number, tabbed = 1): void => {
    plate(c, at, alpha);
    rule(c, { x: at.x + 1, y: at.y + m.head, length: at.w - 2, down: false }, alpha);
    if (shape.kind === "window") titled(c, at, m, alpha, shape.tabs, tabbed);
    else pocketed(c, at, m, alpha);
  };

  /** The meter and the ground give way to the app's first shape, and the Cell that grew takes its seat in it. */
  const opened = (u: number, t: number, plan: Plan): void => {
    const { m, big } = plan;
    const shape = plan.shapes[0]!,
      room = shape.rooms[0]!,
      seat = seatOf(shape, room, m);
    const gone = 1 - span(u, GONE[0]!, GONE[1]!);
    ground(plan, gone);
    meter(c, plan.meter, MARKS.at(-1)!, gone);
    const up = span(u, RISES[0]!, RISES[1]!),
      size = lerp(SMALL, 1, ease.out(up));
    const { frame } = shape;
    c.save();
    c.translate(frame.x + frame.w / 2, frame.y + frame.h / 2);
    c.scale(size, size);
    c.translate(-frame.x - frame.w / 2, -frame.y - frame.h / 2);
    framed(shape, frame, m, up);
    c.restore();
    // Its chat resolves once the Cell is nearly seated, so the Cell never rides over its own lines.
    const lands = span(u, LANDS[0]!, LANDS[1]!);
    named(c, 0, seat, room.w, m, lands);
    if (shape.kind === "window") chat(c, 0, room, m, lands);
    const e = ease.inOut(u);
    working(
      0,
      { x: lerp(big.x, seat.x, e), y: lerp(big.y, seat.y, e), px: lerp(big.px, seat.px, e) },
      t,
      plan,
    );
  };

  /**
   * A shape dividing within the same outline: who is there makes room, a
   * divider draws, and the newcomer comes into the share that opened. No one
   * changes places, so every moment on the way is a window one could have.
   */
  const divided = (u: number, t: number, a: Shape, b: Shape, plan: Plan): void => {
    const { m } = plan;
    const comes = span(u, COMES[0]!, COMES[1]!);
    framed(b, b.frame, m, 1, a.tabs > 0 ? 1 : comes);
    const drawn = ease.inOut(span(u, DRAWN[0]!, DRAWN[1]!));
    for (const line of b.rules) {
      const known = a.rules.some((r) => r.x === line.x && r.y === line.y && r.down === line.down);
      rule(c, line, 1, known ? 1 : drawn);
    }
    const made = ease.inOut(span(u, ROOM[0]!, ROOM[1]!));
    b.rooms.forEach((is, who) => {
      if (is === undefined) return;
      const was = a.rooms[who];
      const room = was === undefined ? is : between(was, is, made),
        alpha = was === undefined ? comes : 1;
      const seat = seatOf(b, room, m);
      named(c, who, seat, room.w, m, alpha);
      if (b.kind === "window") chat(c, who, room, m, alpha);
      working(who, seat, t, plan, alpha);
    });
  };

  /**
   * A shape becoming one with another outline: the outline eases its place,
   * its size and its corners, each Cell rides to its new seat under its name,
   * and what only one of the two has fades with that one, inside the outline.
   */
  const reshaped = (u: number, t: number, a: Shape, b: Shape, plan: Plan): void => {
    const { m } = plan;
    const e = ease.inOut(u);
    const frame: Outline = {
      ...between(a.frame, b.frame, e),
      r: lerp(a.frame.r, b.frame.r, e),
    };
    plate(c, frame, 1);
    rule(c, { x: frame.x + 1, y: frame.y + m.head, length: frame.w - 2, down: false }, 1);
    c.save();
    c.beginPath();
    c.roundRect(frame.x + 1, frame.y + 1, frame.w - 2, frame.h - 2, Math.max(0, frame.r - 1));
    c.clip();
    for (const [shape, alpha] of [
      [a, 1 - span(u, GONE[0]!, GONE[1]!)],
      [b, span(u, LANDS[0]!, LANDS[1]!)],
    ] as const) {
      if (alpha <= 0) continue;
      if (shape.kind === "window") titled(c, frame, m, alpha, shape.tabs, 1);
      else pocketed(c, frame, m, alpha);
      for (const line of shape.rules) {
        const at = carried({ ...line, w: line.length, h: line.length }, shape.frame, frame);
        rule(c, { ...line, x: at.x, y: at.y, length: line.down ? at.h : at.w }, alpha);
      }
      if (shape.kind === "window")
        shape.rooms.forEach((room, who) => {
          if (room !== undefined) chat(c, who, carried(room, shape.frame, frame), m, alpha);
        });
    }
    c.restore();
    // Across, a Cell keeps pace with the outline. Down, it is in its column while the outline
    // is still wide, so no Cell crosses another's name on the way.
    const stacked = ease.inOut(span(b.kind === "phone" ? u : 1 - u, 0, STACKS)),
      down = b.kind === "phone" ? stacked : 1 - stacked;
    a.rooms.forEach((was, who) => {
      const is = b.rooms[who];
      if (was === undefined || is === undefined) return;
      const from = seatOf(a, was, m),
        to = seatOf(b, is, m);
      const seat = {
        x: lerp(from.x, to.x, e),
        y: frame.y + lerp(from.y - a.frame.y, to.y - b.frame.y, down),
        px: m.px,
      };
      named(c, who, seat, lerp(was.w, is.w, e), m, 1);
      working(who, seat, t, plan);
    });
  };

  const fit = (canvas: HTMLCanvasElement, f: SceneFrame, d: number): void => {
    const width = Math.round(f.width * d),
      height = Math.round(f.height * d);
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    canvas.style.width = `${f.width}px`;
    canvas.style.height = `${f.height}px`;
  };

  scene(
    root,
    (f) => {
      glyphs.size(f.width, f.height);
      if (f.fresh || plan === null) {
        plan = lay(f);
        fit(cells, f, plan.d);
        fit(things, f, plan.d);
      }
      glyphs.clear();
      context.clearRect(0, 0, cells.width, cells.height);
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.clearRect(0, 0, things.width, things.height);
      c.setTransform(plan.d, 0, 0, plan.d, 0, 0);
      const k = TURNS.findLastIndex(([from]) => f.p >= from);
      if (plan.fits) {
        const u = k < 0 ? 0 : span(f.p, TURNS[k]![0], TURNS[k]![1]);
        const a = plan.shapes[k - 1],
          b = plan.shapes[k];
        if (b === undefined) grow(f.p, f.t, plan);
        else if (a === undefined) opened(u, f.t, plan);
        else if (a.kind === b.kind) divided(u, f.t, a, b, plan);
        else reshaped(u, f.t, a, b, plan);
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
