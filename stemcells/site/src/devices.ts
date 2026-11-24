// 04 · Every machine: one crew, on every machine you own. Six machines stand at
// different distances in a dark room; Cells are thrown from the one in your
// hand to three Mac minis far off, and every screen keeps the same tally. The
// eye turns a little round the near machine as the scroll plays, for parallax.

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
 * A staging's room at rest. Across and up are CSS pixels from the middle of
 * the near machine's top, at the size the room was composed at.
 */
interface Room {
  /** The one in your hand, the two beside it (the left answers), and what is said under yours. */
  readonly hand: Kind;
  readonly left: Kind;
  readonly right: Kind;
  readonly held: string;
  /** The box it was composed in: its width, and the air over the near machine's top. */
  readonly wide: number;
  readonly sky: number;
  /** Each mini's top, on a shelf running off to the right: across, up, how many times as far. */
  readonly minis: readonly (readonly [number, number, number])[];
  /** How far over the near machine's top the two beside it have their middles. */
  readonly beside: readonly [number, number];
  /** How high each throw's arc tops out, nearest mini first, and the answer's over them all. */
  readonly tops: readonly [number, number, number, number];
  /** Each machine's drawing, columns by rows of its own cells. */
  readonly shapes: Readonly<Record<Kind, readonly [number, number]>>;
}
const ROOMS: Readonly<Record<Form, Room>> = {
  desk: {
    hand: "MacBook",
    left: "iPhone",
    right: "iPad",
    held: "on your desk",
    wide: 793,
    sky: 425,
    minis: [
      [186, 98, 1.7],
      [278, 128, 2],
      [358, 152, 2.3],
    ],
    beside: [56, -30],
    tops: [165, 245, 320, 405],
    shapes: { MacBook: [22, 7], iPhone: [12, 10], iPad: [16, 11], mini: [12, 3] },
  },
  tablet: {
    hand: "iPad",
    left: "iPhone",
    right: "MacBook",
    held: "in your hand",
    wide: 734,
    sky: 480,
    minis: [
      [170, 120, 1.7],
      [262, 160, 2],
      [340, 192, 2.3],
    ],
    beside: [80, -70],
    tops: [190, 280, 360, 460],
    shapes: { MacBook: [20, 7], iPhone: [12, 10], iPad: [18, 12], mini: [12, 3] },
  },
  phone: {
    hand: "iPhone",
    left: "MacBook",
    right: "iPad",
    held: "in your hand",
    wide: 345,
    sky: 252,
    minis: [
      [78, 40, 1.9],
      [128, 68, 2.15],
      [176, 96, 2.4],
    ],
    beside: [88, -42],
    tops: [84, 134, 184, 238],
    shapes: { MacBook: [18, 7], iPhone: [12, 10], iPad: [14, 9], mini: [10, 3] },
  },
};
const STAGES = ["Input", "Flying", "Landed"] as const;

/** The story's beats along the scroll. */
const AT = {
  /** The rest of the room starts to arrive. */
  room: 0.12,
  arrive: [0.125, 0.158, 0.19, 0.215, 0.24],
  /** How long one machine takes to draw in. */
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
 * How far the eye turns round the near machine over the scene, and how much
 * nearer it comes. It sets off while only that machine is there to see, so the
 * rest arrive in a room already turning, and it slows all the way to its rest.
 */
const YAW = (12 * Math.PI) / 180,
  PUSH = 0.05,
  SLOWING = 1.5;
/** A toss falls this fast, a second², as the app's own (`cell/toss.ts`). */
const GRAVITY = 1400;
/** Story seconds a landing's springs play; the wind-up before a throw, its press and its lean. */
const SPRINGS = 0.7,
  CROUCH = 0.16,
  PRESS = 640,
  LEAN_BACK = 1.6;
/** The far end's ink as a share of the near end's; a hairline's share, and a quiet word's. */
const FAR_INK = 0.66,
  HAIR = 0.4,
  QUIET = 0.42;

/**
 * A place in the room: x to the right, y up from the eye's level, z away from
 * the eye. One is a CSS pixel at the near machine's distance.
 */
interface Place {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}
/** The eye. The room turns round the near machine, so that one never moves on the page. */
interface Eye {
  /** The near machine's middle on the page, and the eye's level there. */
  readonly hx: number;
  readonly hy: number;
  readonly level: number;
  /** How far the near machine is from the eye. */
  readonly near: number;
}
interface View extends Eye {
  readonly sin: number;
  readonly cos: number;
  readonly zoom: number;
}
interface Spot {
  readonly x: number;
  readonly y: number;
}

/** Where a place in the room falls on the page. */
function see(view: View, at: Place): Spot {
  const dz = at.z - view.near;
  const across = at.x * view.cos - dz * view.sin,
    away = view.near + at.x * view.sin + dz * view.cos;
  const k = view.near / away;
  return {
    x: view.hx + across * k * view.zoom,
    y: view.hy + (view.level - at.y * k - view.hy) * view.zoom,
  };
}

interface Flight {
  readonly from: Place;
  readonly to: Place;
  /** Its speed a second: across, away, and up as it leaves. */
  readonly vx: number;
  readonly vz: number;
  readonly vy: number;
  readonly time: number;
}

/** The throw from one place to another that passes `over` above the higher of the two. */
function flightOver(from: Place, to: Place, over: number): Flight {
  const apex = Math.max(from.y, to.y) + over;
  const up = Math.sqrt((2 * (apex - from.y)) / GRAVITY),
    down = Math.sqrt((2 * (apex - to.y)) / GRAVITY);
  const time = up + down;
  return {
    from,
    to,
    vx: (to.x - from.x) / time,
    vz: (to.z - from.z) / time,
    vy: GRAVITY * up,
    time,
  };
}

/** Where it is `s` seconds into `flight`. */
const placeAt = (flight: Flight, s: number): Place => ({
  x: flight.from.x + flight.vx * s,
  y: flight.from.y + flight.vy * s - 0.5 * GRAVITY * s * s,
  z: flight.from.z + flight.vz * s,
});

/** The throw between two places whose arc, seen through `view`, tops out at `top` on the page. */
function flightUnder(view: View, from: Place, to: Place, top: number): Flight {
  const topOf = (flight: Flight): number => {
    let y = Infinity;
    for (let n = 0; n <= 48; n++)
      y = Math.min(y, see(view, placeAt(flight, (n / 48) * flight.time)).y);
    return y;
  };
  // Thrown higher over its ends, it tops out higher: halve the way to the height asked for.
  let low = 4,
    high = 4000;
  for (let n = 0; n < 24; n++) {
    const over = (low + high) / 2;
    if (topOf(flightOver(from, to, over)) > top) low = over;
    else high = over;
  }
  return flightOver(from, to, (low + high) / 2);
}

interface Dot {
  readonly at: Place;
  /** Seconds into the flight when it passes. */
  readonly s: number;
}

/** A flight's path as dots `gap` apart along it, through the room. */
function trailOf(flight: Flight, gap: number): Dot[] {
  const dots: Dot[] = [];
  let last = flight.from;
  let far = 0,
    next = gap * 0.75;
  const steps = Math.ceil(flight.time * 600);
  for (let n = 1; n <= steps; n++) {
    const s = (n / steps) * flight.time;
    const at = placeAt(flight, s);
    far += Math.hypot(at.x - last.x, at.y - last.y, at.z - last.z);
    last = at;
    if (far >= next) {
      dots.push({ at, s });
      next += gap;
    }
  }
  return dots;
}

interface Stroke {
  /** From the machine's middle, CSS pixels. */
  readonly dx: number;
  readonly dy: number;
  readonly ch: string;
  /** When in its machine's arrival it is drawn, 0..1. */
  readonly at: number;
}

interface Machine {
  readonly kind: Kind;
  /** Its cells' height: whole and even, and its own for good, so its lines always meet. */
  readonly h: number;
  readonly at: Place;
  /** How deep in the room it stands: 0 the near one, 1 the farthest. */
  readonly deep: number;
  readonly strokes: readonly Stroke[];
  /** From its middle up to where feet stand on it, and down to its foot. */
  readonly top: number;
  readonly foot: number;
  /** Its tally's first line: the left edge and the middle, from the machine's middle. */
  readonly tally: readonly [number, number] | null;
  /** What it is called, how tall that is written, and what is said under it. */
  readonly label: string;
  readonly labelH: number;
  readonly held: string;
  /** When it arrives along the scroll; the near one is there from the start. */
  readonly arrives: number;
}

/** A machine's line drawing on its own cells, from its middle, and where its tally starts. */
function drawingOf(
  kind: Kind,
  cols: number,
  rows: number,
  h: number,
): Pick<Machine, "strokes" | "top" | "foot" | "tally"> {
  const w = h / 2;
  const left = (-cols * w) / 2,
    up = (-rows * h) / 2;
  const strokes: Stroke[] = [];
  const put = (i: number, j: number, ch: string, at: number) =>
    strokes.push({ dx: left + (i + 0.5) * w, dy: up + (j + 0.5) * h, ch, at });
  // The outline, drawn clockwise from its top left corner. An open MacBook's
  // screen stands on its base, seen edge on: the foot of the outline runs on past both corners.
  const open = kind === "MacBook";
  const around = 2 * (cols + rows) - 4,
    outline = 0.6;
  for (let i = 0; i < cols; i++) {
    put(i, 0, i === 0 ? "┌" : i === cols - 1 ? "┐" : "─", (i / around) * outline);
    if (i > 0 && i < cols - 1)
      put(i, rows - 1, "─", ((cols + rows - 2 + (cols - 1 - i)) / around) * outline);
  }
  for (let j = 1; j < rows; j++) {
    const foot = j === rows - 1;
    put(cols - 1, j, foot ? (open ? "┴" : "┘") : "│", ((cols - 1 + j) / around) * outline);
    put(
      0,
      j,
      foot ? (open ? "┴" : "└") : "│",
      ((2 * cols + rows - 3 + (rows - 1 - j)) / around) * outline,
    );
  }
  if (open) for (const i of [-2, -1, cols, cols + 1]) put(i, rows - 1, "─", outline + 0.1);
  else if (kind === "mini") put(cols - 3, 1, "·", 0.7);
  else for (const i of [cols / 2 - 1, cols / 2]) put(i, rows - 2, "─", 0.7);
  const first = kind === "iPhone" ? 3 : Math.floor((rows - 3) / 2);
  return {
    strokes,
    top: (rows * h) / 2 - h / 2 + 1,
    foot: (rows * h) / 2,
    tally: kind === "mini" ? null : [left + ((cols - 8) / 2) * w, up + (first + 0.5) * h],
  };
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
  /** Where on the near machine's top it stands, from that machine's middle. */
  readonly root: number;
  /** The machine it runs on. */
  readonly mini: number;
  readonly flight: Flight;
  readonly dots: readonly Dot[];
  /** When it lands for good. */
  readonly lands: number;
}

interface Layout {
  /** The height of the art box it was made for. */
  readonly high: number;
  readonly eye: Eye;
  /** The near one, the two beside it (the left one answers), and the minis left to right. */
  readonly machines: readonly Machine[];
  readonly throws: readonly Throw[];
  readonly answer: {
    readonly flight: Flight;
    readonly dots: readonly Dot[];
    readonly over: number;
  };
  /** CSS pixels an art pixel of a Cell, near and far, and how many times as far the far end is. */
  readonly cellNear: number;
  readonly cellFar: number;
  readonly depth: number;
  /** A trail's dot, near and far: its cell's height. */
  readonly dot: readonly [number, number];
}

export function devices(root: HTMLElement): void {
  const cells = layerIn(root, "cells");
  const context = cells.getContext("2d")!;
  const glyphs = new Glyphs(layerIn(root, "glyphs"));
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
    const phone = f.form === "phone";
    const room = ROOMS[f.form];
    // Each distance has its own cell: the near machine's as large as the box lets it be.
    const roomy = phone ? [430, 350] : [600, 470];
    const near = ah >= roomy[0]! && (phone || aw >= 600) ? 16 : ah >= roomy[1]! ? 14 : 12;
    const mid = phone ? 10 : Math.max(10, near - 4),
      far = 8;
    const depth = room.minis.at(-1)![2];
    const cellNear = phone ? 1.5 : near >= 16 ? 3 : 2,
      cellFar = 1;
    const nameH = phone ? 12 : 14;

    // Down the box: the room's air, the near machine, and what is said under it.
    const [handCols, handRows] = room.shapes[room.hand];
    const under = 6 + nameH + 3 + (nameH - 2);
    const floor = ay + ah - under - (phone ? 2 : Math.min(40, ah * 0.05));
    const air = floor - handRows * near - ay - 6;
    const sx = clamp(aw / room.wide, 0.8, 1.2),
      sy = clamp(air / room.sky, 0.2, 1.1);
    // With air to spare, the room stands in the middle of it.
    const handTop = Math.round(floor - handRows * near - Math.max(0, air - room.sky * sy) / 2);
    const hx = Math.round(ax + aw / 2 - aw * (phone ? 0.08 : 0.03)),
      hy = handTop + (handRows * near) / 2;
    const eye: Eye = {
      hx,
      hy,
      level: handTop - room.sky * sy,
      near: aw * (phone ? 0.85 : 0.95),
    };
    const rest: View = { ...eye, sin: 0, cos: 1, zoom: 1 };
    /** A spot on the page at rest, `z` times as far as the near machine, as a place in the room. */
    const placed = (x: number, y: number, z: number): Place => ({
      x: (x - hx) * z,
      y: (eye.level - y) * z,
      z: eye.near * z,
    });
    const machine = (
      kind: Kind,
      h: number,
      x: number,
      y: number,
      z: number,
      arrives: number,
    ): Machine => ({
      kind,
      h,
      at: placed(x, y, z),
      deep: (z - 1) / (depth - 1),
      ...drawingOf(kind, room.shapes[kind][0], room.shapes[kind][1], h),
      label: kind,
      labelH: h === near ? nameH : h === far ? 10 : phone ? 10 : 12,
      held: h === near ? room.held : "",
      arrives,
    });
    const hand = machine(room.hand, near, hx, hy, 1, -1);

    // The minis, each clear of the last however narrow the box.
    const [miniCols, miniRows] = room.shapes.mini;
    const miniTop = (miniRows * far) / 2 - far / 2 + 1;
    let last = -Infinity;
    const minis = room.minis.map(([across, up, z], n) => {
      last = Math.max(across * sx, last + (miniCols * far) / 2 + 6);
      return machine(
        "mini",
        far,
        Math.round(hx + last),
        Math.round(handTop - up * sy) + miniTop,
        z,
        AT.arrive[2 + n]!,
      );
    });

    // The two beside it stand in from the room's edges, the left by as far as the turn slides it.
    const away = near / mid;
    const slide = (eye.near * (away - 1) * Math.sin(YAW)) / (1 + (away - 1) * Math.cos(YAW));
    const reach = (kind: Kind) => ((room.shapes[kind][0] + (kind === "MacBook" ? 4 : 0)) * mid) / 4;
    const half = (kind: Kind) => (room.shapes[kind][1] * mid) / 2;
    const inset = Math.max(0, (aw - room.wide * 1.2) / 2);
    const leftX = Math.round(ax + inset + reach(room.left) + slide + 4),
      rightX = Math.round(ax + aw - inset - reach(room.right) - 4);
    // The left one's name stays clear of a Cell standing on the near machine, where the two meet.
    const meets = leftX + reach(room.left) > hx - (handCols * near) / 4 - 17 * cellNear;
    const leftY = Math.max(
      ay + half(room.left) + 4,
      handTop - Math.max(room.beside[0] * sy, meets ? 30 * cellNear + 26 + half(room.left) : 0),
    );
    // The right one stands under the names of the minis over it, no lower than the near machine.
    const named = (m: Machine) => see(rest, m.at).y + m.foot + 6 + m.labelH;
    const over = minis
      .filter(
        (m) => Math.abs(see(rest, m.at).x - rightX) < reach(room.right) + (miniCols * far) / 4,
      )
      .map(named);
    const rightY = Math.min(
      floor - half(room.right),
      Math.max(
        handTop - room.beside[1] * Math.min(1, sy),
        ...over.map((y) => y + 8 + half(room.right)),
      ),
    );
    const left = machine(room.left, mid, leftX, Math.round(leftY), away, AT.arrive[0]);
    const right = machine(room.right, mid, rightX, Math.round(rightY), away, AT.arrive[1]);
    const machines = [hand, left, right, ...minis];

    // The farther a Cell is thrown, the further left on the near machine it starts: no arc crosses.
    const spread = Math.min(
      handCols * near * 0.15,
      (handCols * near) / 4 - 13 * cellNear,
      phone ? 22 : 99,
    );
    const throws = team.map((cell, n): Throw => {
      const mini = 3 + AIM[n]!;
      const root = (1 - AIM[n]!) * spread;
      const to = machines[mini]!,
        z = room.minis[AIM[n]!]![2];
      const flight = flightUnder(
        rest,
        { x: root, y: hand.at.y + hand.top, z: eye.near },
        { ...to.at, y: to.at.y + to.top * z },
        handTop - room.tops[AIM[n]!]! * sy,
      );
      return {
        cell,
        from: AT.throws[n]!,
        clock: clockOf(AT.throws[n]!, flight.time),
        root,
        mini,
        flight,
        dots: trailOf(flight, phone ? 16 : 22),
        lands: n === ASKS ? AT.answered : AT.lands[n < ASKS ? n : n - 1]!,
      };
    });
    // The answer comes down on the question, which stands over its Cell's head.
    const asker = throws[ASKS]!;
    const overHead = riseOf(frameAt(asker.cell, "waiting", 0)) * cellFar + 12;
    const answer = flightUnder(
      rest,
      { ...left.at, y: left.at.y + left.top * away },
      { ...asker.flight.to, y: asker.flight.to.y + overHead * depth },
      handTop - room.tops[3] * sy,
    );
    return {
      high: ah,
      eye,
      machines,
      throws,
      answer: { flight: answer, dots: trailOf(answer, phone ? 16 : 22), over: overHead },
      cellNear,
      cellFar,
      depth,
      dot: phone ? [18, 12] : [22, 13],
    };
  };

  scene(
    root,
    (f) => {
      const d = density();
      glyphs.size(f.width, f.height);
      if (cells.width !== Math.round(f.width * d) || cells.height !== Math.round(f.height * d)) {
        cells.width = Math.round(f.width * d);
        cells.height = Math.round(f.height * d);
        cells.style.width = `${f.width}px`;
        cells.style.height = `${f.height}px`;
      }
      // A narrow phone wraps the longest line: the words keep its height, so the room stays put.
      if (f.fresh && !reduced) beat.style.minHeight = `${tallest()}px`;
      if (f.fresh || lay === null || lay.high !== f.art.height) lay = layout(f);
      const { machines, throws, answer, depth } = lay;
      const { p } = f;

      let line = BEATS[0]![1];
      for (const [at, words] of BEATS) if (p >= at) line = words;
      if (line !== said) {
        said = line;
        beat.textContent = line;
      }

      // The eye's one move: round the near machine and a little nearer, all the way through.
      const turned = 1 - (1 - span(p, 0, AT.rests)) ** SLOWING;
      const yaw = YAW * (1 - turned);
      const view: View = {
        ...lay.eye,
        sin: Math.sin(yaw),
        cos: Math.cos(yaw),
        zoom: 1 - PUSH * (1 - turned),
      };
      /** How deep a place is: 0 at the near machine, 1 at the far end. */
      const deepOf = (at: Place): number => clamp((at.z / view.near - 1) / (depth - 1));
      const inkAt = (deep: number): number => lerp(1, FAR_INK, deep);
      // Each machine on whole device pixels, so its lines keep meeting as it slides.
      const spots = machines.map((m): Spot => {
        const at = see(view, m.at);
        return { x: Math.round(at.x * d) / d, y: Math.round(at.y * d) / d };
      });
      const hand = machines[0]!,
        handAt = spots[0]!;
      /** Where a flight is on the page `s` seconds in, tied at both ends to what it joins. */
      const flown = (flight: Flight, a: Spot, b: Spot) => {
        const from = see(view, flight.from),
          to = see(view, flight.to);
        return (s: number): Spot => {
          const at = see(view, placeAt(flight, s)),
            u = s / flight.time;
          return {
            x: at.x + lerp(a.x - from.x, b.x - to.x, u),
            y: at.y + lerp(a.y - from.y, b.y - to.y, u),
          };
        };
      };

      glyphs.clear();

      // The machines, and what each screen says.
      machines.forEach((m, n) => {
        const came = m.arrives < 0 ? 1 : span(p, m.arrives, m.arrives + AT.arriving);
        if (came <= 0) return;
        const { x, y } = spots[n]!;
        const ink = inkAt(m.deep);
        // A hairline under a device pixel wide draws fainter than asked: asked for more, it holds.
        const hair = HAIR * lerp(1, 0.8, m.deep) * clamp(1.6 / (0.09 * m.h * d), 1, 2);
        for (const s of m.strokes)
          glyphs.put(s.ch, x + s.dx, y + s.dy, m.h, INK, hair * span(came, s.at, s.at + 0.3));
        const worded = ease.inOut(span(came, 0.6, 1));
        const labelY = y + m.foot + 6 + m.labelH / 2;
        glyphs.text(
          m.label,
          x - (m.label.length * m.labelH) / 4,
          labelY,
          m.labelH,
          INK,
          0.85 * ink * worded,
        );
        if (m.held !== "") {
          const h = m.labelH - 2;
          glyphs.text(
            m.held,
            x - (m.held.length * h) / 4,
            labelY + m.labelH / 2 + 3 + h / 2,
            h,
            INK,
            QUIET,
          );
        }
        if (m.tally === null) return;
        const w = m.h / 2;
        STAGES.forEach((stage, k) => {
          const [was, now, mix] = countAt(COUNTS[k]!, p);
          const lit = lerp(was > 0 ? 1 : 0, now > 0 ? 1 : 0, mix);
          const rgb: Rgb =
            k === 0
              ? [
                  lerp(INK[0], AMBER[0], lit),
                  lerp(INK[1], AMBER[1], lit),
                  lerp(INK[2], AMBER[2], lit),
                ]
              : INK;
          const a = lerp(QUIET, 1, lit) * ink * worded;
          const row = y + m.tally![1] + k * m.h,
            from = x + m.tally![0];
          glyphs.text(stage, from, row, m.h, rgb, a);
          if (mix < 1) glyphs.put(String(was), from + 7.5 * w, row, m.h, rgb, a * (1 - mix));
          glyphs.put(String(now), from + 7.5 * w, row, m.h, rgb, a * mix);
        });
      });

      /** A trail's dots, as far as `age` (story seconds since the flight began) has laid them. */
      const trail = (dots: readonly Dot[], at: (s: number) => Spot, age: number) => {
        for (const dot of dots) {
          const since = age - dot.s;
          if (since <= 0) break;
          const deep = deepOf(dot.at);
          const { x, y } = at(dot.s);
          const fresh = Math.min(1, since / 0.05) * lerp(0.46, 0.95, Math.exp(-since / 0.3));
          glyphs.put("·", x, y, lerp(lay!.dot[0], lay!.dot[1], deep), INK, fresh * inkAt(deep));
        }
      };

      // Each throw: its trail, and where its Cell is.
      const cast: { cell: Cell; frame: MiniFrame; at: Spot; px: number; hidden: number }[] = [];
      const points = lay.cellNear * 2;
      /** Device pixels to a Cell's art pixel that far off: the far size from the nearest mini on. */
      const sized = (z: number) =>
        Math.max(1, Math.round(lerp(lay!.cellNear, lay!.cellFar, clamp((z - 1) / 0.6)) * d));
      throws.forEach((t, n) => {
        if (p < t.from) return;
        const { cell, flight } = t;
        const mini = machines[t.mini]!,
          miniAt = spots[t.mini]!;
        const start: Spot = { x: handAt.x + t.root, y: handAt.y - hand.top },
          end: Spot = { x: miniAt.x, y: miniAt.y - mini.top };
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
            px: sized(placeAt(flight, s).z / view.near),
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
          cast.push({ cell, frame, at: end, px: sized(flight.to.z / view.near), hidden: 0 });
        }
      });

      // The question over the one that asks, and the answer on its way there from another machine.
      const asker = throws[ASKS]!;
      const askerAt = spots[asker.mini]!,
        askerOn = machines[asker.mini]!;
      const question: Spot = { x: askerAt.x, y: askerAt.y - askerOn.top - answer.over };
      const asked =
        span(p, AT.asks, AT.asks + TURN) * (1 - span(p, AT.answered, AT.answered + TURN));
      glyphs.put(
        "?",
        question.x,
        question.y + (1 - ease.out(span(p, AT.asks, AT.asks + TURN))) * 5,
        16,
        AMBER,
        asked,
      );
      if (p > AT.answer) {
        const from = machines[1]!,
          fromAt = spots[1]!;
        const at = flown(answer.flight, { x: fromAt.x, y: fromAt.y - from.top }, question);
        const s = span(p, AT.answer, AT.answered) * answer.flight.time;
        trail(answer.dots, at, s + span(p, AT.answered, AT.answered + CHEER) * SPRINGS);
        const { x, y } = at(s);
        const deep = deepOf(placeAt(answer.flight, s));
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
