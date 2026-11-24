// 04 · Every machine: one crew, on every machine you own. Six machines stand in
// a dark room on a dotted floor: yours, two beside it, three Mac minis on a
// shelf. Cells are thrown from yours to the minis, and every screen keeps the
// same tally. The eye walks a little way round the near machine as it plays.

import { type Hit, type MiniFrame, sceneOf, type Toss, tossFrame } from "./app-cells.ts";
import { BELOW, type Cell, crew, drawCell, frameAt, lengthOf } from "./cells.ts";
import { clamp, density, ease, type Form, lerp, reduced, span } from "./kit/form.ts";
import { AMBER, Glyphs, INK, type Rgb } from "./kit/glyphs.ts";
import { layerIn, scene, type SceneFrame } from "./kit/scenes.ts";

const CREW = [
  ["Otter", "claude"],
  ["Waffle", "codex"],
  ["Pickle", "gemini"],
] as const;
/** What each does on its mini while it flies. */
const WORK = ["building/0", "testing/0", "reading/0"] as const;
/** The mini each is thrown at: the middle one, the farthest, then the nearest, inside both. */
const AIM = [1, 2, 0] as const;
/** The one that asks: the farthest, so the answer comes in over every trail and crosses none. */
const ASKS = 1;

type Kind = "MacBook" | "iPhone" | "iPad" | "mini";
/**
 * A staging's room at rest, as it was composed: across its box from the left,
 * and up from the floor line the near machine stands on, in CSS pixels.
 */
interface Room {
  /** The one in your hand, the two beside it (the left answers), and what is said under yours. */
  readonly hand: Kind;
  readonly left: Kind;
  readonly right: Kind;
  readonly held: string;
  /** The box it was composed in: its width, and its height over the floor line. */
  readonly wide: number;
  readonly sky: number;
  /** How high over that line the eye is; how far it is from the near machine, in box widths. */
  readonly eye: number;
  readonly lens: number;
  /** How far round the near machine the eye starts, degrees. */
  readonly yaw: number;
  /** The near machine: its middle across the box, and how wide it is. */
  readonly near: readonly [number, number];
  /** The two beside it, on the floor: across, how wide, and how many times as far. */
  readonly beside: readonly [readonly [number, number, number], readonly [number, number, number]];
  /** The shelf: its first mini's middle, its height, a mini's width, their pitch, how far. */
  readonly shelf: readonly [number, number, number, number, number];
  /** Where along the near machine's top each throw starts: the nearest mini's first. */
  readonly stands: readonly [number, number, number];
  /** How high each throw's arc tops out, nearest mini first, and the answer's over them all. */
  readonly tops: readonly [number, number, number, number];
  /** The tally's type on the near screen and on the two beside it. */
  readonly type: readonly [number, number];
  /** A name's type: the near machine's, the two beside it, a mini's. */
  readonly names: readonly [number, number, number];
  /** CSS pixels an art pixel of a Cell, near and on the shelf. */
  readonly cell: readonly [number, number];
  /** How far apart the floor's dots are, at the near machine. */
  readonly grid: number;
  /** A trail's dot, near and far: its cell's height. */
  readonly dot: readonly [number, number];
  /** Its iPad lies on its side. */
  readonly lying: boolean;
}
const DESK: Room = {
  hand: "MacBook",
  left: "iPhone",
  right: "iPad",
  held: "on your desk",
  wide: 793,
  sky: 690,
  eye: 430,
  lens: 0.95,
  yaw: 18,
  near: [356, 300],
  beside: [
    [112, 76, 1.45],
    [690, 152, 1.45],
  ],
  shelf: [520, 340, 84, 108, 2.2],
  stands: [0, -48, -96],
  tops: [440, 520, 600, 680],
  type: [16, 11],
  names: [13, 12, 11],
  cell: [3, 2],
  grid: 46,
  dot: [24, 15],
  lying: true,
};
const TABLET: Room = {
  hand: "iPad",
  left: "iPhone",
  right: "MacBook",
  held: "in your hand",
  wide: 734,
  sky: 750,
  eye: 470,
  lens: 0.95,
  yaw: 18,
  near: [345, 210],
  beside: [
    [104, 74, 1.45],
    [640, 132, 1.45],
  ],
  shelf: [462, 410, 84, 106, 2.2],
  stands: [0, -28, -56],
  tops: [490, 570, 650, 740],
  type: [16, 11],
  names: [13, 12, 11],
  cell: [3, 2],
  grid: 46,
  dot: [24, 15],
  lying: false,
};
const PHONE: Room = {
  hand: "iPhone",
  left: "iPad",
  right: "MacBook",
  held: "in your hand",
  wide: 346,
  sky: 500,
  eye: 385,
  lens: 0.6,
  yaw: 10,
  near: [172, 122],
  beside: [
    [51, 74, 1.35],
    [294, 78, 1.35],
  ],
  shelf: [216, 318, 44, 50, 2.2],
  stands: [-2, -16, -30],
  tops: [352, 402, 452, 492],
  type: [16, 10],
  names: [13, 11, 10],
  cell: [1.5, 1],
  grid: 28,
  dot: [20, 13],
  lying: false,
};
/** A tablet's box when it is far wider than tall: the iPad on its side, the room spread out. */
const LOW: Room = {
  ...TABLET,
  wide: 900,
  sky: 315,
  eye: 245,
  lens: 0.8,
  yaw: 16,
  near: [330, 236],
  beside: [
    [92, 62, 1.4],
    [838, 104, 1.4],
  ],
  shelf: [520, 178, 80, 96, 2],
  stands: [0, -36, -72],
  tops: [215, 236, 257, 310],
  cell: [2, 2],
  grid: 52,
  lying: true,
};
/** A phone's box when it is as wide as tall: everything smaller, the same places. */
const SQUAT: Room = {
  ...PHONE,
  wide: 282,
  sky: 210,
  eye: 170,
  near: [118, 72],
  beside: [
    [36, 40, 1.4],
    [246, 54, 1.4],
  ],
  shelf: [184, 138, 36, 40, 2.1],
  stands: [0, -8, -16],
  tops: [158, 169, 180, 209],
  type: [10, 7],
  names: [11, 10, 9],
  cell: [1, 1],
  grid: 26,
  dot: [16, 12],
};
/** The room a box gets: its staging's, or that staging's other one where the box is too low. */
function roomIn(form: Form, wide: number, high: number): Room {
  if (form === "desk") return DESK;
  if (form === "tablet") return wide > high * 1.6 ? LOW : TABLET;
  return wide > high * 0.9 ? SQUAT : PHONE;
}
const STAGES = ["Input", "Flying", "Landed"] as const;

/** The story's beats along the scroll. */
const AT = {
  /** The rest of the room starts to arrive. */
  room: 0.12,
  arrive: [0.125, 0.158, 0.19, 0.215, 0.24],
  /** How long one machine takes to come up. */
  arriving: 0.05,
  throws: [0.3, 0.405, 0.51],
  asks: 0.655,
  answer: 0.795,
  answered: 0.855,
  /** The other two land. */
  lands: [0.878, 0.9],
  /** The eye comes to rest. */
  rests: 0.94,
} as const;
/** A throw's own beats from its start: up onto the edge, the wind-up, the flight, the springs. */
const THROW = { up: 0.014, crouch: 0.022, thrown: 0.034, landed: 0.094, sprung: 0.114 } as const;
/** How much of the scroll a count takes to change, and a cheer to play. */
const TURN = 0.012,
  CHEER = 0.03;
const BEATS: readonly (readonly [number, string])[] = [
  [0, "Start on the one in your hand."],
  [AT.room, "The rest are already in the room."],
  [AT.throws[0], "Throw from here. It flies over there."],
  [0.62, "When one asks, every screen knows."],
  [0.78, "Answer from whichever is closest."],
  [0.92, "One crew. Every screen."],
];
const LONGEST = BEATS.reduce(
  (longest, [, words]) => (words.length > longest.length ? words : longest),
  "",
);
/** What every screen counts, as the story changes it: when, and to what. */
const COUNTS: readonly (readonly (readonly [number, number])[])[] = [
  [
    [AT.asks, 1],
    [AT.answered, 0],
  ],
  [
    [AT.throws[0] + THROW.thrown, 1],
    [AT.throws[1] + THROW.thrown, 2],
    [AT.throws[2] + THROW.thrown, 3],
    [AT.asks, 2],
    [AT.lands[0], 1],
    [AT.lands[1], 0],
  ],
  [
    [AT.answered, 1],
    [AT.lands[0], 2],
    [AT.lands[1], 3],
  ],
];

/**
 * The eye's one move: round the near machine and a little nearer. It sets off
 * while only that machine is there to see, so the rest arrive in a room
 * already turning, and it slows all the way to its rest.
 */
const PUSH = 0.06,
  SLOWING = 1.5;
/** A toss falls this fast, a second², as the app's own (`cell/toss.ts`). */
const GRAVITY = 1400;
/** Story seconds a landing's springs play; the wind-up before a throw, its press and its lean. */
const SPRINGS = 0.7,
  CROUCH = 0.16,
  PRESS = 640,
  LEAN_BACK = 1.6;

/** Shares of a machine's width: a MacBook's lid, its deck, and how far the deck flares. */
const LID = 0.64,
  DECK = 0.1,
  FLARE = 0.07;
/** An iPhone's height; a mini's front and top faces, and how far the top's back edge stands in. */
const TALL = 2.05,
  FRONT = 0.2,
  TOP = 0.17,
  TAPER = 0.06;
/** A machine comes up from this size. */
const GROWS = 0.96;
/** The solid look: a hairline's ink, a name's and a tally's, each near, beside and on the shelf. */
const HAIR = [0.5, 0.34, 0.26] as const,
  WORD = [1, 0.82, 0.62] as const;
const DIM = 0.68,
  QUIET = 0.42,
  MARK = 0.25;
const FONT = 'ui-monospace, "SF Mono", SFMono-Regular, Menlo, Consolas, monospace';
const NIGHT = "#0b0b0c",
  RAISED = "#151514";
/** The floor: its dots' ink and size near and far, and the depths it fades between. */
const FLOOR = 0.34,
  SPECK = [2, 1] as const,
  FADES = [1.45, 2.9] as const;
/** How far round the near machine the floor shows before the room arrives; its soft edge. */
const POOL = 0.75,
  POOL_EDGE = 0.4;
/** A room fills a box up to this many times its own size, and spreads this much wider or taller. */
const GROWN = 1.25,
  SPREAD = 1.15;

const tint = (rgb: Rgb, alpha: number): string => `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${alpha})`;
const smooth = (u: number): number => u * u * (3 - 2 * u);

/** How tall a machine stands, and how high feet land on it, as shares of its width. */
function highOf(kind: Kind, lying: boolean): number {
  if (kind === "MacBook") return LID + DECK;
  if (kind === "iPhone") return TALL;
  if (kind === "iPad") return lying ? 0.75 : 4 / 3;
  return FRONT + TOP;
}
const standOf = (kind: Kind, lying: boolean): number =>
  kind === "mini" ? FRONT + TOP / 2 : highOf(kind, lying);

/**
 * A place in the room: x to the right, y up from the eye's level, z away from
 * the eye. One is a CSS pixel at the near machine's distance.
 */
interface Place {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}
/** The eye at rest. The room turns round the near machine's foot, which never moves on the page. */
interface Eye {
  /** That foot on the page. */
  readonly hx: number;
  readonly floor: number;
  /** How high over the floor the eye is, and how far from the near machine. */
  readonly high: number;
  readonly near: number;
  /** How far round it starts, radians. */
  readonly yaw: number;
}
interface View extends Eye {
  readonly sin: number;
  readonly cos: number;
  /** How far the eye is from the near machine now, and its level on the page. */
  readonly dist: number;
  readonly level: number;
}
interface Spot {
  readonly x: number;
  readonly y: number;
}
/** A spot on the page, and how many page pixels one of the room's is there. */
interface Sight extends Spot {
  readonly k: number;
}

/** Where a place in the room falls on the page. */
function see(view: View, at: Place): Sight {
  const dz = at.z - view.near;
  const across = at.x * view.cos - dz * view.sin,
    away = view.dist + at.x * view.sin + dz * view.cos;
  const k = view.near / away;
  return { x: view.hx + across * k, y: view.level - at.y * k, k };
}

/** The eye `turned` of the way to its rest. */
function viewAt(eye: Eye, turned: number): View {
  const yaw = eye.yaw * (1 - turned),
    dist = eye.near * (1 + PUSH * (1 - turned));
  return {
    ...eye,
    sin: Math.sin(yaw),
    cos: Math.cos(yaw),
    dist,
    level: eye.floor - (eye.high * eye.near) / dist,
  };
}
/** How far the eye has come by `p` along the scroll. */
const turnedAt = (p: number): number => 1 - (1 - span(p, 0, AT.rests)) ** SLOWING;

/** A throw through the room. */
interface Flight {
  /** Where it is `s` seconds in. */
  readonly at: (s: number) => Place;
  /** Its speed across the page at rest, and up it as it leaves, CSS pixels a second. */
  readonly vx: number;
  readonly vy: number;
  readonly time: number;
}

interface Dot {
  readonly at: Place;
  /** Seconds into the flight when it passes. */
  readonly s: number;
}

/** A flight's path as dots `gap` apart along it, through the room. */
function trailOf(flight: Flight, gap: number): Dot[] {
  const dots: Dot[] = [];
  let last = flight.at(0);
  let far = 0,
    next = gap * 0.75;
  const steps = Math.ceil(flight.time * 600);
  for (let n = 1; n <= steps; n++) {
    const s = (n / steps) * flight.time;
    const at = flight.at(s);
    far += Math.hypot(at.x - last.x, at.y - last.y, at.z - last.z);
    last = at;
    if (far >= next) {
      dots.push({ at, s });
      next += gap;
    }
  }
  return dots;
}

interface Machine {
  readonly kind: Kind;
  /** The middle of its foot, in the room. */
  readonly at: Place;
  /** How many times as far as the near one it stands: the near one, beside it, or on the shelf. */
  readonly z: number;
  readonly rank: 0 | 1 | 2;
  /** At rest on the page: how wide it is, how tall, and how high feet stand on it. */
  readonly w: number;
  readonly high: number;
  readonly stand: number;
  /** Its tally's type at rest; none without a screen. */
  readonly type: number;
  /** What it is called, how tall that is written, and what is said under it. */
  readonly label: string;
  readonly labelH: number;
  readonly held: string;
  /** When it arrives along the scroll; the near one is there from the start. */
  readonly arrives: number;
}
/** A machine in one frame: its foot on the page, its size against rest, how far it has come. */
interface Seen extends Spot {
  readonly q: number;
  readonly came: number;
}

type Corner = readonly [x: number, y: number, r: number];
type Pen = CanvasRenderingContext2D;

/** A closed outline through `corners`, each rounded by its own radius. */
function outline(pen: Pen, corners: readonly Corner[]): void {
  const last = corners.at(-1)!,
    first = corners[0]!;
  pen.beginPath();
  pen.moveTo((last[0] + first[0]) / 2, (last[1] + first[1]) / 2);
  corners.forEach(([x, y, r], n) => {
    const next = corners[(n + 1) % corners.length]!;
    pen.arcTo(x, y, next[0], next[1], Math.max(0, r));
  });
  pen.closePath();
}
/** A box's corners, clockwise from its top left: one radius, or the top's and the foot's. */
const box = (x0: number, y0: number, x1: number, y1: number, r: number, foot = r): Corner[] => [
  [x0, y0, r],
  [x1, y0, r],
  [x1, y1, foot],
  [x0, y1, foot],
];

/**
 * One machine, drawn solid on whole device pixels: a hairline of `line`, the
 * night inside it, its screen raised. `mark` inks its one small detail.
 */
function drawMachine(pen: Pen, m: Machine, at: Seen, d: number, line: string, mark: string): void {
  const R = (v: number) => Math.round(v * d);
  const w = m.w * at.q,
    half = d / 2;
  const x0 = R(at.x - w / 2),
    x1 = R(at.x + w / 2),
    y0 = R(at.y - m.high * at.q),
    y1 = R(at.y);
  const mid = (x0 + x1) / 2;
  pen.lineWidth = d;
  pen.strokeStyle = line;
  const fill = (corners: readonly Corner[], colour: string) => {
    outline(pen, corners);
    pen.fillStyle = colour;
    pen.fill();
  };
  /** A box with its hairline inside its own edge. */
  const body = (top: number, foot: number, r: number, low = r) => {
    fill(box(x0, top, x1, foot, r, low), NIGHT);
    outline(pen, box(x0 + half, top + half, x1 - half, foot - half, r - half, low - half));
    pen.stroke();
  };
  if (m.kind === "MacBook") {
    const hinge = R(at.y - DECK * w),
      out = R(FLARE * w);
    const r = Math.max(2 * d, R(0.04 * w)),
      edge = Math.max(2 * d, R(0.028 * w)),
      turn = Math.max(d, R(0.025 * w));
    fill(
      [
        [x0, hinge, 0],
        [x1, hinge, 0],
        [x1 + out, y1, turn],
        [x0 - out, y1, turn],
      ],
      RAISED,
    );
    // The deck's far edge is the lid's foot: only its sides and its near edge are drawn.
    pen.beginPath();
    pen.moveTo(x0 + half, hinge);
    pen.arcTo(x0 - out + half, y1 - half, x1 + out - half, y1 - half, turn);
    pen.arcTo(x1 + out - half, y1 - half, x1 - half, hinge, turn);
    pen.lineTo(x1 - half, hinge);
    pen.stroke();
    body(y0, hinge, r, d);
    fill(box(x0 + edge, y0 + edge, x1 - edge, hinge - edge, Math.max(d, r - edge)), RAISED);
    const pad = R(0.11 * w);
    pen.fillStyle = line;
    pen.fillRect(Math.round(mid - pad), Math.round(lerp(hinge, y1, 0.52) - half), pad * 2, d);
  } else if (m.kind === "iPhone") {
    const r = R(0.2 * w),
      edge = Math.max(2 * d, R(0.035 * w));
    body(y0, y1, r);
    fill(box(x0 + edge, y0 + edge, x1 - edge, y1 - edge, r - edge), RAISED);
    const long = R(0.15 * w) * 2,
      thick = Math.max(2 * d, R(0.085 * w)),
      left = Math.round(mid - long / 2),
      top = y0 + edge + R(0.075 * w);
    fill(box(left, top, left + long, top + thick, thick / 2), mark);
  } else if (m.kind === "iPad") {
    const short = Math.min(x1 - x0, y1 - y0);
    const r = Math.round(0.085 * short),
      edge = Math.max(2 * d, Math.round(0.05 * short));
    body(y0, y1, r);
    fill(box(x0 + edge, y0 + edge, x1 - edge, y1 - edge, Math.max(d, r - edge)), RAISED);
  } else {
    const front = R(at.y - FRONT * w),
      taper = R(TAPER * w);
    const back = R(0.06 * w),
      low = R(0.05 * w);
    fill(
      [
        [x0 + taper, y0, back],
        [x1 - taper, y0, back],
        [x1, front, 0],
        [x0, front, 0],
      ],
      RAISED,
    );
    fill(box(x0, front, x1, y1, 0, low), NIGHT);
    outline(pen, [
      [x0 + taper + half, y0 + half, back],
      [x1 - taper - half, y0 + half, back],
      [x1 - half, front, d],
      [x1 - half, y1 - half, low],
      [x0 + half, y1 - half, low],
      [x0 + half, front, d],
    ]);
    pen.stroke();
    pen.fillStyle = line;
    pen.fillRect(x0 + d, Math.round(front - half), x1 - x0 - 2 * d, d);
    const lamp = Math.max(d, R(0.028 * w));
    pen.fillStyle = mark;
    pen.fillRect(x1 - R(0.15 * w), Math.round((front + y1 - lamp) / 2), lamp, lamp);
  }
}

/** One throw's clock: story seconds since its wind-up began, straight between its beats. */
function clockOf(from: number, time: number): (p: number) => number {
  const knots = [
    [from + THROW.crouch, 0],
    [from + THROW.thrown, CROUCH],
    [from + THROW.landed, CROUCH + time],
    [from + THROW.sprung, CROUCH + time + SPRINGS],
  ] as const;
  return (p) => {
    let n = 1;
    while (n < knots.length - 1 && p > knots[n]![0]) n++;
    const [p0, t0] = knots[n - 1]!,
      [p1, t1] = knots[n]!;
    return lerp(t0, t1, span(p, p0, p1));
  };
}

/** A count along the scroll: what it was, what it is, and how far the change has come. */
function countAt(
  steps: readonly (readonly [number, number])[],
  p: number,
): readonly [was: number, now: number, mix: number] {
  let was = 0,
    now = 0,
    mix = 1;
  for (const [at, to] of steps) {
    if (p < at) break;
    was = now;
    now = to;
    mix = span(p, at, at + TURN);
  }
  return [was, now, mix];
}

/** The art's rows a frame stands above its feet: to the top of whatever it wears. */
function riseOf(frame: MiniFrame): number {
  const rows = frame.drawn.detail;
  const top = rows.findIndex((row) => /[^.]/.test(row));
  return rows.length - BELOW - Math.max(0, top);
}

interface Throw {
  readonly cell: Cell;
  /** Where along the scroll it starts, and its own clock from there. */
  readonly from: number;
  readonly clock: (p: number) => number;
  /** Where on the near machine's top it stands, from that machine's middle, at rest. */
  readonly root: number;
  /** The machine it runs on. */
  readonly mini: number;
  readonly flight: Flight;
  readonly dots: readonly Dot[];
  /** When it lands for good. */
  readonly lands: number;
}

interface Layout {
  /** The art box it was made for. */
  readonly wide: number;
  readonly high: number;
  readonly eye: Eye;
  /** The near one, the two beside it (the left one answers), and the minis left to right. */
  readonly machines: readonly Machine[];
  /** The line the minis stand on, end to end. */
  readonly shelf: readonly [Place, Place];
  readonly throws: readonly Throw[];
  readonly answer: {
    readonly flight: Flight;
    readonly dots: readonly Dot[];
    readonly over: number;
  };
  /** CSS pixels an art pixel of a Cell, near and far, and how many times as far the shelf is. */
  readonly cellNear: number;
  readonly cellFar: number;
  readonly depth: number;
  /** A trail's dot, near and far; and how far apart the floor's dots are, in the room. */
  readonly dot: readonly [number, number];
  readonly grid: number;
}

export function devices(root: HTMLElement): void {
  // Last in is lowest: the Cells over the trails, the trails over the machines and their floor.
  const cells = layerIn(root, "cells");
  const context = cells.getContext("2d")!;
  const glyphs = new Glyphs(layerIn(root, "glyphs"));
  const things = layerIn(root, "things");
  const pen = things.getContext("2d")!;
  const team = crew(CREW);
  const beat = root.querySelector<HTMLElement>(".beat")!;
  let said = "";
  let lay: Layout | null = null;

  /** A scene's frame `t` seconds in; Reduce Motion holds the frame that tells it. */
  const playing = (cell: Cell, key: string, t: number): MiniFrame => {
    const told = reduced ? sceneOf(cell.look, key) : undefined;
    return told?.mini[told.tell] ?? frameAt(cell, key, t);
  };

  /** How tall the beat's longest line stands, measured on a hidden copy as wide as the beat. */
  const tallest = (): number => {
    const copy = document.createElement("p");
    copy.className = beat.className;
    copy.setAttribute("aria-hidden", "true");
    copy.textContent = LONGEST;
    copy.style.cssText = `position:absolute;visibility:hidden;min-height:0;width:${beat.clientWidth}px`;
    beat.after(copy);
    const tall = copy.offsetHeight;
    copy.remove();
    return tall;
  };

  const layout = (f: SceneFrame): Layout => {
    const { x: ax, y: ay, width: aw, height: ah } = f.art;
    const d = density();
    const room = roomIn(f.form, aw, ah);
    // Under the floor line, the near machine's name and what is said of it, at their own size.
    const under = 8 + room.names[0] + 5 + 11 + 5;
    const s = Math.min(aw / room.wide, (ah - under) / room.sky, GROWN);
    // A box of another shape: the room spreads a little, then stands in the middle of it.
    const fx = Math.min(aw / (room.wide * s), SPREAD),
      fy = Math.min((ah - under) / (room.sky * s), SPREAD);
    const left = ax + (aw - room.wide * s * fx) / 2;
    const floor = Math.round(ay + ah - under - (ah - under - room.sky * s * fy) / 2);
    const X = (x: number) => left + x * s * fx,
      up = (h: number) => h * s * fy;
    const eye: Eye = {
      hx: Math.round(X(room.near[0])),
      floor,
      high: up(room.eye),
      near: room.wide * s * fx * room.lens,
      yaw: (room.yaw * Math.PI) / 180,
    };
    const rest = viewAt(eye, 1);
    /** A spot on the page at rest, `high` over the floor line and `z` times as far, in the room. */
    const placed = (x: number, high: number, z: number): Place => ({
      x: (x - eye.hx) * z,
      y: (high - eye.high) * z,
      z: eye.near * z,
    });
    const [, shelfUp, miniW, pitch, depth] = room.shelf;
    const machine = (
      kind: Kind,
      rank: 0 | 1 | 2,
      at: Place,
      z: number,
      w: number,
      arrives: number,
    ): Machine => {
      const lying = kind === "iPad" && room.lying;
      // A tally keeps to its screen, and the near one never falls under what can be read.
      const tall = (kind === "MacBook" ? LID : highOf(kind, lying)) * w;
      const fits = Math.min((w * 0.86) / (8 * 0.61), (tall - 12) / 3.7);
      const type =
        kind === "mini"
          ? 0
          : Math.min(fits, rank === 0 ? Math.max(9, room.type[0] * s) : room.type[1] * s);
      return {
        kind,
        at,
        z,
        rank,
        w,
        high: highOf(kind, lying) * w,
        stand: standOf(kind, lying) * w,
        type,
        label: kind,
        labelH: room.names[rank],
        held: rank === 0 ? room.held : "",
        arrives,
      };
    };
    const hand = machine(room.hand, 0, placed(eye.hx, 0, 1), 1, room.near[1] * s, -1);
    /** One beside it, standing on the floor `z` times as far. */
    const beside = (kind: Kind, n: 0 | 1): Machine => {
      const [x, w, z] = room.beside[n];
      const at = placed(X(x), eye.high * (1 - 1 / z), z);
      const made = machine(kind, 1, at, z, w * s, AT.arrive[n]);
      if (n === 1) return made;
      // The turn slides the left one further left: it stands in from the box's edge by that much.
      const first = see(viewAt(eye, turnedAt(made.arrives)), at);
      const reach = (made.w * (kind === "MacBook" ? 0.5 + FLARE : 0.5) * first.k * z) / GROWS;
      const short = ax + 3 - (first.x - reach);
      return short <= 0 ? made : { ...made, at: { ...at, x: at.x + short / first.k } };
    };
    const minis = [0, 1, 2].map((n) =>
      machine(
        "mini",
        2,
        placed(X(room.shelf[0]) + n * pitch * s * fx, up(shelfUp), depth),
        depth,
        miniW * s,
        AT.arrive[2 + n]!,
      ),
    );
    const machines = [hand, beside(room.left, 0), beside(room.right, 1), ...minis];
    const jut = (miniW * s * 0.5 + Math.min(14, miniW * s * 0.15)) * depth;
    const ends = [minis[0]!.at, minis[2]!.at] as const;
    const shelf = [
      { ...ends[0], x: ends[0].x - jut },
      { ...ends[1], x: ends[1].x + jut },
    ] as const;

    // Whole device pixels to a Cell's art pixel, and the larger where a box falls between two.
    const whole = (px: number) => Math.max(1, Math.round(px * s * d + 0.15)) / d;
    const cellNear = whole(room.cell[0]),
      cellFar = Math.min(cellNear, whole(room.cell[1]));
    /**
     * A toss as the page shows it at rest, under the app's own gravity, topping
     * out `top` down the page while it goes from `z0` to `z1` times as far.
     */
    const toss = (a: Spot, z0: number, b: Spot, z1: number, top: number): Flight => {
      const peak = Math.min(top, a.y - 4, b.y - 4);
      const rise = Math.sqrt((2 * (a.y - peak)) / GRAVITY),
        time = rise + Math.sqrt((2 * (b.y - peak)) / GRAVITY);
      const vx = (b.x - a.x) / time,
        vy = GRAVITY * rise;
      return {
        vx,
        vy,
        time,
        at: (t) =>
          placed(
            a.x + vx * t,
            floor - (a.y - vy * t + 0.5 * GRAVITY * t * t),
            lerp(z0, z1, t / time),
          ),
      };
    };
    /** Where feet stand on a machine at rest, `dx` across from its middle. */
    const stood = (m: Machine, dx = 0): Spot => {
      const at = see(rest, m.at);
      return { x: at.x + dx, y: at.y - m.stand };
    };
    // A Cell at the top of its arc still stands inside the box, whatever it wears.
    const rows = Math.max(...team.map((cell) => riseOf(frameAt(cell, "idle", 0))));
    const headroom = ((rows + 6) * (cellNear + cellFar)) / 2;
    const topAt = (n: number) => Math.max(floor - up(room.tops[n]!), ay + (n < 3 ? headroom : 4));
    const throws = team.map((cell, n): Throw => {
      const mini = 3 + AIM[n]!;
      // The farther it is thrown, the further left on the near machine it starts: no arc crosses.
      const rootAt = room.stands[AIM[n]!]! * s;
      const flight = toss(stood(hand, rootAt), 1, stood(machines[mini]!), depth, topAt(AIM[n]!));
      return {
        cell,
        from: AT.throws[n]!,
        clock: clockOf(AT.throws[n]!, flight.time),
        root: rootAt,
        mini,
        flight,
        dots: trailOf(flight, room.dot[0] * s),
        lands: n === ASKS ? AT.answered : AT.lands[n < ASKS ? n : n - 1]!,
      };
    });
    // The answer comes down on the question, which stands over its Cell's head.
    const asker = throws[ASKS]!,
      from = machines[1]!;
    const overHead = riseOf(frameAt(asker.cell, "waiting", 0)) * cellFar + 12;
    const asked = stood(machines[asker.mini]!);
    const answer = toss(
      stood(from),
      from.z,
      { x: asked.x, y: asked.y - overHead },
      depth,
      topAt(3),
    );
    return {
      wide: aw,
      high: ah,
      eye,
      machines,
      shelf,
      throws,
      answer: { flight: answer, dots: trailOf(answer, room.dot[0] * s), over: overHead },
      cellNear,
      cellFar,
      depth,
      dot: [room.dot[0] * Math.min(1, s), room.dot[1] * Math.min(1, s)],
      grid: room.grid * s,
    };
  };

  scene(
    root,
    (f) => {
      const d = density();
      glyphs.size(f.width, f.height);
      for (const canvas of [cells, things]) {
        if (canvas.width === Math.round(f.width * d) && canvas.height === Math.round(f.height * d))
          continue;
        canvas.width = Math.round(f.width * d);
        canvas.height = Math.round(f.height * d);
        canvas.style.width = `${f.width}px`;
        canvas.style.height = `${f.height}px`;
      }
      // A narrow phone wraps the longest line: the words keep its height, so the room stays put.
      if (f.fresh && !reduced) beat.style.minHeight = `${tallest()}px`;
      if (f.fresh || lay === null || lay.wide !== f.art.width || lay.high !== f.art.height)
        lay = layout(f);
      const { machines, throws, answer, depth, eye } = lay;
      const { p } = f;
      const { x: ax, width: aw } = f.art;

      let line = BEATS[0]![1];
      for (const [at, words] of BEATS) if (p >= at) line = words;
      if (line !== said) {
        said = line;
        beat.textContent = line;
      }

      const view = viewAt(eye, turnedAt(p));
      /** How deep a place is: 0 at the near machine, 1 at the shelf. */
      const deepOf = (at: Place): number => clamp((at.z / view.near - 1) / (depth - 1));
      // Each machine's foot on whole device pixels, so its hairlines stay hairlines as it slides.
      const seen = machines.map((m): Seen => {
        const at = see(view, m.at);
        const came = m.arrives < 0 ? 1 : span(p, m.arrives, m.arrives + AT.arriving);
        return {
          x: Math.round(at.x * d) / d,
          y: Math.round(at.y * d) / d,
          q: at.k * m.z * lerp(GROWS, 1, ease.out(came)),
          came,
        };
      });
      /** Where feet stand on a machine, as it is drawn. */
      const standing = (n: number, dx = 0): Spot => {
        const at = seen[n]!,
          m = machines[n]!;
        return { x: at.x + dx * at.q, y: Math.round((at.y - m.stand * at.q) * d) / d };
      };
      /** Where a flight is on the page `s` seconds in, tied at both ends to what it joins. */
      const flown = (flight: Flight, a: Spot, b: Spot) => {
        const from = see(view, flight.at(0)),
          to = see(view, flight.at(flight.time));
        return (s: number): Spot => {
          const at = see(view, flight.at(s)),
            u = s / flight.time;
          return {
            x: at.x + lerp(a.x - from.x, b.x - to.x, u),
            y: at.y + lerp(a.y - from.y, b.y - to.y, u),
          };
        };
      };

      pen.setTransform(1, 0, 0, 1, 0, 0);
      pen.globalAlpha = 1;
      pen.clearRect(0, 0, things.width, things.height);

      // The floor: the same dots of the room every frame, each on whole device pixels.
      const lit = lerp(POOL, depth + 1.5, ease.inOut(span(p, AT.room, AT.arrive[4] + AT.arriving)));
      pen.fillStyle = tint(INK, 1);
      for (let j = 0; ; j++) {
        const dz = j * lay.grid;
        const far = 1 + dz / eye.near;
        const fade = 1 - smooth(span(far, FADES[0], FADES[1]));
        if (fade <= 0) break;
        const px = Math.max(1, Math.round(lerp(SPECK[0], SPECK[1], span(far, 1, FADES[1])) * d));
        // A row shows no further across than the box is wide, that far off.
        const reach = Math.ceil((aw * far) / lay.grid);
        for (let i = -reach; i <= reach; i++) {
          const x = i * lay.grid;
          const shown = smooth(span(lit - Math.hypot(x, dz) / eye.near, 0, POOL_EDGE));
          if (shown <= 0) continue;
          const at = see(view, { x, y: -eye.high, z: eye.near + dz });
          // It thins out at the box's edges and under the near machine's foot, short of any words.
          const kept =
            span(at.x, ax, ax + 64) *
            span(at.x, ax + aw, ax + aw - 64) *
            span(eye.floor + 30 - at.y, 0, 24);
          const alpha = FLOOR * fade * shown * kept;
          if (alpha < 0.012) continue;
          pen.globalAlpha = alpha;
          pen.fillRect(Math.round(at.x * d - px / 2), Math.round(at.y * d - px / 2), px, px);
        }
      }

      // The shelf, then the machines from the far end forward: a nearer one covers a farther.
      const shelved = ease.inOut(span(p, AT.arrive[2], AT.arrive[2] + AT.arriving));
      const [a, b] = [see(view, lay.shelf[0]), see(view, lay.shelf[1])];
      const slope = (b.y - a.y) / (b.x - a.x),
        level = Math.abs(a.y - b.y) * d < 0.5;
      if (shelved > 0) {
        pen.globalAlpha = shelved;
        pen.strokeStyle = pen.fillStyle = tint(INK, HAIR[2]);
        // Level, it is the hairline under the minis' feet; turned, a line through the same feet.
        if (level)
          pen.fillRect(
            Math.round(a.x * d),
            Math.round(a.y * d) - d,
            Math.round((b.x - a.x) * d),
            d,
          );
        else {
          pen.lineWidth = d;
          pen.beginPath();
          pen.moveTo(a.x * d, a.y * d - d / 2);
          pen.lineTo(b.x * d, b.y * d - d / 2);
          pen.stroke();
        }
      }
      const counts = STAGES.map((_, k) => countAt(COUNTS[k]!, p));
      /** A line of type from its left edge, on whole device pixels. */
      const write = (words: string, x: number, y: number) =>
        pen.fillText(words, Math.round(x), Math.round(y));
      pen.textAlign = "left";
      pen.textBaseline = "alphabetic";
      for (let n = machines.length - 1; n >= 0; n--) {
        const m = machines[n]!,
          at = seen[n]!;
        if (at.came <= 0) continue;
        pen.globalAlpha = ease.inOut(at.came);
        // A mini leans with its shelf while the room is turned; level, it is on whole pixels again.
        if (m.rank === 2 && !level) pen.setTransform(1, slope, 0, 1, 0, -slope * at.x * d);
        const word = WORD[m.rank];
        drawMachine(
          pen,
          m,
          at,
          d,
          tint(INK, HAIR[m.rank]),
          tint(INK, m.kind === "mini" ? QUIET : MARK * word),
        );
        pen.setTransform(1, 0, 0, 1, 0, 0);

        // Its name under it, on the night: the floor's dots stay out of the words.
        const small = `400 ${11 * d}px ${FONT}`;
        pen.font = small;
        const held = m.held === "" ? 0 : pen.measureText(m.held).width;
        pen.font = `500 ${m.labelH * d}px ${FONT}`;
        const named = pen.measureText(m.label).width,
          wide = Math.max(named, held);
        const base = Math.round((at.y + 8 + m.labelH * 0.8) * d);
        pen.fillStyle = NIGHT;
        pen.fillRect(
          Math.round(at.x * d - wide / 2 - 4 * d),
          Math.round((at.y + 4) * d),
          Math.round(wide + 8 * d),
          Math.round((m.labelH + (held > 0 ? 24 : 8)) * d),
        );
        pen.fillStyle = tint(INK, (m.rank === 0 ? 1 : DIM) * word);
        write(m.label, at.x * d - named / 2, base);
        if (held > 0) {
          pen.font = small;
          pen.fillStyle = tint(INK, QUIET);
          write(m.held, at.x * d - held / 2, base + 16 * d);
        }
        if (m.type === 0) continue;

        // Its screen: the same three lines on every one, each count turning as the story does.
        const type = m.type * at.q * d;
        const middle =
          m.kind === "MacBook"
            ? at.y - (DECK + LID / 2) * m.w * at.q
            : at.y - m.high * at.q * (m.kind === "iPhone" ? 0.55 : 0.5);
        pen.font = `600 ${type}px ${FONT}`;
        const ch = pen.measureText("0").width;
        const from = Math.round(at.x * d - 4 * ch),
          row = Math.round(1.5 * type),
          first = Math.round(middle * d + 0.34 * type) - row;
        STAGES.forEach((stage, k) => {
          const [was, now, mix] = counts[k]!;
          const on = lerp(was > 0 ? 1 : 0, now > 0 ? 1 : 0, mix);
          const rgb: Rgb =
            k === 0
              ? [lerp(INK[0], AMBER[0], on), lerp(INK[1], AMBER[1], on), lerp(INK[2], AMBER[2], on)]
              : INK;
          const alpha = lerp(QUIET, 1, on) * word;
          pen.fillStyle = tint(rgb, alpha);
          write(stage, from, first + k * row);
          if (mix < 1) {
            pen.fillStyle = tint(rgb, alpha * (1 - mix));
            write(String(was), from + 7 * ch, first + k * row);
          }
          pen.fillStyle = tint(rgb, alpha * mix);
          write(String(now), from + 7 * ch, first + k * row);
        });
      }
      pen.globalAlpha = 1;

      glyphs.clear();
      /** A trail's dots, as far as `age` (story seconds since the flight began) has laid them. */
      const trail = (dots: readonly Dot[], at: (s: number) => Spot, age: number) => {
        for (const dot of dots) {
          const since = age - dot.s;
          if (since <= 0) break;
          const deep = deepOf(dot.at);
          const { x, y } = at(dot.s);
          const fresh = Math.min(1, since / 0.05) * lerp(0.46, 0.95, Math.exp(-since / 0.3));
          glyphs.put(
            "·",
            x,
            y,
            lerp(lay!.dot[0], lay!.dot[1], deep),
            INK,
            fresh * lerp(1, 0.7, deep),
          );
        }
      };

      // Each throw: its trail, and where its Cell is.
      const cast: { cell: Cell; frame: MiniFrame; at: Spot; px: number; hidden: number }[] = [];
      const points = lay.cellNear * 2;
      /** Device pixels to a Cell's art pixel that far off: whole, the shelf's from there on. */
      const sized = (z: number) =>
        Math.max(
          1,
          Math.round(lerp(lay!.cellNear, lay!.cellFar, clamp((1 - 1 / z) / (1 - 1 / depth))) * d),
        );
      throws.forEach((t, n) => {
        if (p < t.from) return;
        const { cell, flight } = t;
        const start = standing(0, t.root),
          end = standing(t.mini);
        const at = flown(flight, start, end);
        const tau = t.clock(p),
          ms = tau * 1000;
        trail(t.dots, at, tau - CROUCH);
        const press: Hit = { surface: "floor", speed: PRESS, along: -flight.vx * LEAN_BACK, at: 0 };
        const down = (hits: readonly Hit[]): Toss => ({
          held: false,
          vx: 0,
          vy: 0,
          grounded: true,
          hits,
        });
        if (p < t.from + THROW.crouch) {
          // Up over the edge of the machine it is thrown from, then standing on it.
          cast.push({
            cell,
            frame: playing(cell, "idle", f.t),
            at: start,
            px: sized(1),
            hidden: 1 - ease.out(span(p, t.from, t.from + THROW.up)),
          });
        } else if (tau < CROUCH) {
          cast.push({
            cell,
            frame: tossFrame(cell.look, down([press]), ms, points),
            at: start,
            px: sized(1),
            hidden: 0,
          });
        } else if (tau < CROUCH + flight.time) {
          const s = tau - CROUCH;
          const toss: Toss = {
            held: false,
            vx: flight.vx,
            vy: GRAVITY * s - flight.vy,
            grounded: false,
            hits: [press],
          };
          cast.push({
            cell,
            frame: tossFrame(cell.look, toss, ms, points),
            at: at(s),
            px: sized(flight.at(s).z / view.near),
            hidden: 0,
          });
        } else {
          let frame: MiniFrame;
          if (tau < CROUCH + flight.time + SPRINGS) {
            const landing: Hit = {
              surface: "floor",
              speed: GRAVITY * flight.time - flight.vy,
              along: flight.vx,
              at: (CROUCH + flight.time) * 1000,
            };
            frame = tossFrame(cell.look, down([landing]), ms, points);
          } else if (p >= t.lands)
            // One cheer, played by the scroll; then it waits to be read.
            frame =
              p < t.lands + CHEER
                ? playing(
                    cell,
                    "happy",
                    span(p, t.lands, t.lands + CHEER) * lengthOf(cell, "happy"),
                  )
                : playing(cell, "idle", f.t);
          else frame = playing(cell, n === ASKS && p >= AT.asks ? "waiting" : WORK[n]!, f.t);
          cast.push({ cell, frame, at: end, px: sized(depth), hidden: 0 });
        }
      });

      // The question over the one that asks, and the answer on its way there from another machine.
      const asker = throws[ASKS]!;
      const stood = standing(asker.mini);
      const question: Spot = { x: stood.x, y: stood.y - answer.over };
      const asked =
        span(p, AT.asks, AT.asks + TURN) * (1 - span(p, AT.answered, AT.answered + TURN));
      glyphs.put(
        "?",
        question.x,
        question.y + (1 - ease.out(span(p, AT.asks, AT.asks + TURN))) * 5,
        10 + 6 * lay.cellFar,
        AMBER,
        asked,
      );
      if (p > AT.answer) {
        const at = flown(answer.flight, standing(1), question);
        const s = span(p, AT.answer, AT.answered) * answer.flight.time;
        trail(answer.dots, at, s + span(p, AT.answered, AT.answered + CHEER) * SPRINGS);
        const { x, y } = at(s);
        const deep = deepOf(answer.flight.at(s));
        glyphs.put(
          "•",
          x,
          y,
          lerp(26, 20, deep),
          INK,
          span(p, AT.answer, AT.answer + 0.006) * (1 - span(p, AT.answered, AT.answered + TURN)),
        );
      }
      glyphs.flush();

      // The Cells, far ones first, on whole device pixels.
      context.clearRect(0, 0, cells.width, cells.height);
      for (const { cell, frame, at, px, hidden } of cast.sort((a, b) => a.px - b.px)) {
        if (hidden <= 0) {
          drawCell(context, cell, frame, { x: at.x * d, y: at.y * d, px });
          continue;
        }
        const edge = Math.round(at.y * d);
        context.save();
        context.beginPath();
        context.rect(0, 0, cells.width, edge);
        context.clip();
        drawCell(context, cell, frame, {
          x: at.x * d,
          y: edge + hidden * (riseOf(frame) + 1) * px,
          px,
        });
        context.restore();
      }
    },
    { still: 1 },
  );
}
