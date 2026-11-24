// 01 · The arc: thrown until it lands. One Cell is thrown at "dark mode": it
// falls short and asks its one question, the answer throws it again, it lands,
// is read, and is settled. The scroll is the only clock: each flight is a
// parabola in closed form over story time, so the scene rewinds as it plays.

import "./arc.css";
import { TONES } from "./actors.ts";
import {
  type Hit,
  type MiniFrame,
  pixelsOf,
  rowsOn,
  sceneOf,
  type Toss,
  tossFrame,
} from "./app-cells.ts";
import { BELOW, type Cell, crew, drawCell, frameAt, lengthOf } from "./cells.ts";
import { type Body, drawBody, type Mark, Morph, textBody } from "./kit/bodies.ts";
import { clamp, density, ease, lerp, reduced, span, touch } from "./kit/form.ts";
import { Glyphs, INK } from "./kit/glyphs.ts";
import { layerIn, scene, type SceneFrame } from "./kit/scenes.ts";

type Stage = "flying" | "input" | "landed" | "settled";
const TONE: Readonly<Record<Stage, string>> = {
  flying: TONES.flying,
  input: TONES.needsYou,
  landed: TONES.landed,
  settled: TONES.settled,
};
/** Between a Cell's name and its stage. */
const DOT = " · ";
const NAME_INK = "rgba(237, 233, 224, 0.8)";
const HINT_INK = "rgba(237, 233, 224, 0.42)";

const WORDS = "add dark mode";
const GOAL = "dark mode";
/** The closing line, by the answer taken. */
const DONE = ["Done: dark mode follows the system.", "Done: dark mode is always on."] as const;
const SETTLE_BY = touch ? "swipe to settle" : "close it to settle";
const FONT =
  'ui-monospace, "SF Mono", SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace';

/** The story's beats along the scroll. */
const AT = {
  crouch: 0.04,
  thrown: 0.07,
  short: 0.27,
  asks: 0.33,
  taken: 0.462,
  answered: 0.48,
  crouchAgain: 0.49,
  thrownAgain: 0.52,
  landed: 0.72,
  cheers: 0.75,
  calm: 0.782,
  hint: 0.79,
  settles: 0.825,
  settled: 0.95,
} as const;
/** Reduce Motion's still: landed and calm, the closing line up, both trails drawn. */
const STILL = 0.786;
/** Where an answer scrolls to: the second throw, just off the ground. */
const ANSWERED = AT.thrownAgain + 0.012;

/** A toss falls this fast, CSS px a second², as the app's own (`cell/toss.ts`). */
const GRAVITY = 1400;
/** Story seconds a landing's springs and faces play before its scene takes over, as an `Actor`'s. */
const SPRINGS = 0.7;
/** The wind-up before a throw: a press the toss's own springs turn into a dip and a rise. Story seconds, and CSS px a second. */
const CROUCH = 0.16;
const PRESS = 640;
/** How far it leans back as it winds up, in its throw's own speed along the ground. */
const LEAN_BACK = 1.6;

interface Flight {
  readonly x0: number;
  readonly y0: number;
  readonly x1: number;
  readonly y1: number;
  readonly vx: number;
  readonly vy: number;
  readonly time: number;
}

/** The throw from one place to another whose feet pass `apex` at the top. */
function flightOver(x0: number, y0: number, x1: number, y1: number, apex: number): Flight {
  const up = Math.sqrt((2 * (y0 - apex)) / GRAVITY),
    down = Math.sqrt((2 * (y1 - apex)) / GRAVITY);
  const time = up + down;
  return { x0, y0, x1, y1, vx: (x1 - x0) / time, vy: -GRAVITY * up, time };
}

/** Where its feet are `s` seconds into `flight`. */
const feetAt = (flight: Flight, s: number): readonly [number, number] => [
  flight.x0 + flight.vx * s,
  flight.y0 + flight.vy * s + 0.5 * GRAVITY * s * s,
];

interface Dot {
  readonly x: number;
  readonly y: number;
  /** Seconds into the flight when the feet pass it. */
  readonly s: number;
}

/** A flight's path as dots `gap` apart along it. */
function trailOf(flight: Flight, gap: number): Dot[] {
  const dots: Dot[] = [];
  let [px, py] = feetAt(flight, 0);
  let far = 0,
    next = gap * 0.75;
  const steps = Math.ceil(flight.time * 600);
  for (let n = 1; n <= steps; n++) {
    const s = (n / steps) * flight.time;
    const [x, y] = feetAt(flight, s);
    far += Math.hypot(x - px, y - py);
    [px, py] = [x, y];
    if (far >= next) {
      dots.push({ x, y, s });
      next += gap;
    }
  }
  return dots;
}

/** The story's clock: story seconds at each beat of the scroll, straight between them. */
function clockOf(first: Flight, second: Flight, cheer: number) {
  const thrown = CROUCH,
    short = thrown + first.time,
    crouchAgain = short + SPRINGS + 0.6,
    thrownAgain = crouchAgain + CROUCH,
    landed = thrownAgain + second.time,
    cheers = landed + SPRINGS,
    calm = cheers + cheer;
  const knots: readonly (readonly [number, number])[] = [
    [0, 0],
    [AT.crouch, 0],
    [AT.thrown, thrown],
    [AT.short, short],
    [AT.asks, short + SPRINGS + 0.1],
    [AT.crouchAgain, crouchAgain],
    [AT.thrownAgain, thrownAgain],
    [AT.landed, landed],
    [AT.cheers, cheers],
    [AT.calm, calm],
    [1, calm + 1],
  ];
  const at = (p: number): number => {
    const n = Math.max(
      1,
      knots.findIndex(([q]) => q >= p),
    );
    const [p0, t0] = knots[n - 1]!,
      [p1, t1] = knots[n] ?? knots.at(-1)!;
    return lerp(t0, t1, span(p, p0, p1));
  };
  return { thrown, short, crouchAgain, thrownAgain, landed, cheers, calm, at };
}

/** The art's rows a frame stands above its feet: to the top of whatever it wears. */
function riseOf(frame: MiniFrame): number {
  const rows = frame.drawn.detail;
  const top = rows.findIndex((row) => /[^.]/.test(row));
  return rows.length - BELOW - Math.max(0, top);
}

/** A Cell's picture as letters, one wherever its art covers a letter's cell, in the art's colour there. */
function lettersOf(cell: Cell, frame: MiniFrame, x: number, y: number, scale: number): Mark[] {
  const rows = rowsOn(frame.drawn.detail, cell.body, "black");
  const wide = rows[0]?.length ?? 0;
  const data = pixelsOf(rows, cell.body);
  const h = Math.max(10, scale * 4),
    w = h / 2;
  const left = x - (wide * scale) / 2,
    top = y - (rows.length - BELOW) * scale;
  const letters = WORDS.replaceAll(" ", "");
  const marks: Mark[] = [];
  for (let j = 0; j * h < rows.length * scale; j++)
    for (let i = 0; i * w < wide * scale; i++) {
      const ax = Math.floor(((i + 0.5) * w) / scale),
        ay = Math.floor(((j + 0.5) * h) / scale);
      const o = (ay * wide + ax) * 4;
      if (ax >= wide || ay >= rows.length || data[o + 3]! < 128) continue;
      marks.push({
        x: left + (i + 0.5) * w,
        y: top + (j + 0.5) * h,
        ch: letters[marks.length % letters.length]!,
        h,
        rgb: [data[o]!, data[o + 1]!, data[o + 2]!],
        a: 1,
      });
    }
  return marks;
}

interface Box {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}

/** How clear (x, y) is of `box`: 0 inside it, 1 from `soft` pixels away. */
function clearOf(box: Box, x: number, y: number, soft = 9): number {
  const dx = Math.max(box.left - x, 0, x - box.right),
    dy = Math.max(box.top - y, 0, y - box.bottom);
  return Math.min(1, Math.hypot(dx, dy) / soft);
}

interface Layout {
  /** CSS pixels an art pixel of the Cell. */
  readonly scale: number;
  readonly ground: number;
  /** The ground's dots, left to right. */
  readonly dots: readonly number[];
  readonly words: Body;
  readonly caption: Body;
  readonly goal: Body;
  readonly first: Flight;
  readonly second: Flight;
  readonly trails: readonly [readonly Dot[], readonly Dot[]];
  readonly clock: ReturnType<typeof clockOf>;
  /** The closing line: under the goal's middle, kept between two edges; its own middle and size. */
  readonly done: {
    readonly x: number;
    readonly left: number;
    readonly right: number;
    readonly y: number;
    readonly h: number;
  };
  readonly settle: Morph;
  /** The label: its size, a character's width, how far over the feet its baseline is at rest, and the rest's rise. */
  readonly label: {
    readonly size: number;
    readonly wide: number;
    readonly over: number;
    readonly rise: number;
  };
}

export function arc(root: HTMLElement): void {
  const pin = root.querySelector<HTMLElement>(".pin")!;
  const cells = layerIn(root, "cells");
  const context = cells.getContext("2d")!;
  const glyphs = new Glyphs(layerIn(root, "glyphs"));
  const [cell] = crew([["Otter", "claude"]]) as [Cell];
  const stages = [...root.querySelectorAll<HTMLElement>(".stages li")];

  const ask = document.createElement("div");
  ask.className = "ask";
  ask.inert = true;
  ask.innerHTML = `<p class="who">${cell.name} asks</p>
    <p class="q">Follow the system, or always dark?</p>
    <div class="options">
      <button type="button" class="best"><span class="peek"><i class="day"></i><i class="night"></i></span><span><kbd>1</kbd>Follow the system</span></button>
      <button type="button"><span class="peek"><i class="night"></i></span><span><kbd>2</kbd>Always dark</span></button>
    </div>`;
  root.querySelector(".art")!.append(ask);
  const options = [...ask.querySelectorAll("button")];

  /** The answer taken by hand, until the question is asked again. */
  let picked: number | null = null;
  let asking = false;
  let lit: Stage | null | undefined;
  let card = "";
  let lay: Layout | null = null;

  const answer = (pick: number) => {
    if (!asking) return;
    picked = pick;
    const travel = root.offsetHeight - pin.offsetHeight;
    scrollTo({
      top: root.getBoundingClientRect().top + scrollY + travel * ANSWERED,
      behavior: "smooth",
    });
  };
  options.forEach((option, n) => option.addEventListener("click", () => answer(n)));
  addEventListener("keydown", (event) => {
    if (event.metaKey || event.ctrlKey || event.altKey || event.repeat) return;
    const on = event.target instanceof HTMLElement ? event.target : null;
    if (on?.isContentEditable || on?.matches("input, textarea, select")) return;
    if (event.key === "1" || event.key === "2") answer(Number(event.key) - 1);
  });

  const points = (scale: number) => scale * 2;
  /** A scene's frame `t` seconds in; Reduce Motion holds the frame that tells it. */
  const playing = (key: string, t: number): MiniFrame => {
    const told = reduced ? sceneOf(cell.look, key) : undefined;
    return told?.mini[told.tell] ?? frameAt(cell, key, t);
  };

  const layout = (f: SceneFrame): Layout => {
    const { x: ax, y: ay, width: aw, height: ah } = f.art;
    const d = density();
    const phone = f.form === "phone";
    const scale = phone || ah < 420 ? 2 : 3;
    const small = phone ? 12 : 13;
    const goalH = phone ? 24 : 32;
    // Low in the box; on a desk, level with the foot of the stages listed beside it.
    const lowest = ay + ah - small - 32;
    const last = stages.at(-1);
    const listed =
      last === undefined
        ? lowest
        : last.getBoundingClientRect().bottom - pin.getBoundingClientRect().top;
    const ground = Math.round(f.form === "desk" ? clamp(listed, ay + ah * 0.7, lowest) : lowest);
    /** The top of a word written `h` tall on the ground, and where feet stand on it: just over its ascenders. */
    const topOf = (h: number) => Math.round(ground - 4 - 0.76 * h);
    const standOn = (h: number) => topOf(h) + Math.round(0.1 * h);

    const settledH = phone ? 12 : 14,
      settledW = (7 * settledH) / 2;
    const wordsLeft = ax + (phone ? 2 : 12),
      wordsW = (WORDS.length * 16) / 2;
    // A phone has no room past the goal: there the ground runs the box's width and `settled` lines up under its end.
    const goalW = (GOAL.length * goalH) / 2,
      goalLeft = Math.round(ax + aw - goalW - (phone ? 4 : settledW + 30));
    const words = textBody(WORDS, { x: wordsLeft, y: topOf(16) });
    const caption = textBody("your words", { x: wordsLeft, y: ground + 14, h: small, a: 0.42 });
    const goal = textBody(GOAL, { x: goalLeft, y: topOf(goalH), h: goalH });
    const dots: number[] = [];
    for (let x = ax + 4; x < ax + aw - (phone ? 0 : settledW + 10); x += 16) dots.push(x);

    const rest = tossFrame(
      cell.look,
      { held: false, vx: 0, vy: 0, grounded: true },
      0,
      points(scale),
    );
    const size = phone ? 11 : 12;
    context.font = `500 ${size * d}px ${FONT}`;
    const label = {
      size,
      wide: context.measureText("0").width / d,
      over: riseOf(rest) * scale + (phone ? 8 : 10),
      rise: riseOf(rest),
    };
    const floor = ground - 2;
    const x0 = wordsLeft + wordsW / 2,
      x1 = Math.round((wordsLeft + wordsW + goalLeft) / 2),
      x2 = goalLeft + goalW / 2;
    // As high as the box lets its label go, and no higher than reads as a throw.
    const room = floor - ay - label.over - size - 4;
    const apex = Math.max(
      40,
      Math.min(room, 440, aw * { desk: 0.5, tablet: 0.6, phone: 0.7 }[f.form]),
    );
    const first = flightOver(x0, standOn(16), x1, floor, floor - Math.max(30, apex * 0.58));
    const second = flightOver(x1, floor, x2, standOn(goalH), floor - apex);

    const settled = textBody("settled", {
      x: ax + aw - settledW - (phone ? 2 : 0),
      y: phone ? ground + 14 : ground - settledH / 2,
      h: settledH,
      a: 0.42,
    });
    const apart = lettersOf(cell, frameAt(cell, "idle", 0), x2, second.y1, scale);

    // The question stands over the Cell that asks it, clear of the way it came, inside the art.
    // A box too short for that puts it beside the Cell, over the goal.
    const over = floor - ay - label.over - size - 14 - ask.offsetHeight;
    const left =
      over < 0 ? x1 - ax + 7 * label.wide + 12 : phone ? (aw - ask.offsetWidth) / 2 : x1 - ax - 34;
    const top = over < 0 ? topOf(goalH) - ay - 12 - ask.offsetHeight : over;
    ask.style.left = `${clamp(left, 8, aw - ask.offsetWidth - 8)}px`;
    ask.style.top = `${Math.max(0, top)}px`;

    return {
      scale,
      ground,
      dots,
      words,
      caption,
      goal,
      first,
      second,
      trails: [trailOf(first, phone ? 11 : 13), trailOf(second, phone ? 11 : 13)],
      clock: clockOf(first, second, lengthOf(cell, "happy")),
      done: { x: x2, left: ax + 2, right: ax + aw - 2, y: ground + 14 + small / 2, h: small },
      settle: new Morph(apart, settled, { lift: 44, stagger: 0.4, seed: 5 }),
      label,
    };
  };

  /** A line of the label's type from `left`, its baseline at `base`: each part in its own ink. */
  const write = (
    d: number,
    left: number,
    base: number,
    parts: readonly (readonly [text: string, ink: string, alpha: number])[],
  ) => {
    context.textAlign = "left";
    context.textBaseline = "alphabetic";
    let at = Math.round(left * d);
    for (const [text, ink, alpha] of parts) {
      context.globalAlpha = alpha;
      context.fillStyle = ink;
      if (alpha > 0) context.fillText(text, at, Math.round(base * d));
      at += context.measureText(text).width;
    }
    context.globalAlpha = 1;
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
      if (f.fresh || lay === null) lay = layout(f);
      const { scale, ground, first, second, clock, label } = lay;
      const { p } = f;
      const tau = clock.at(p),
        ms = tau * 1000;

      // Where it is, what it shows, and the stage it is in.
      const press = (flight: Flight, at: number): Hit => ({
        surface: "floor",
        speed: PRESS,
        along: -flight.vx * LEAN_BACK,
        at: at * 1000,
      });
      const landing = (flight: Flight, at: number): Hit => ({
        surface: "floor",
        speed: flight.vy + GRAVITY * flight.time,
        along: flight.vx,
        at: at * 1000,
      });
      const down = (hits: readonly Hit[]): Toss => ({
        held: false,
        vx: 0,
        vy: 0,
        grounded: true,
        hits,
      });
      const up = (flight: Flight, s: number, hits: readonly Hit[]): Toss => ({
        held: false,
        vx: flight.vx,
        vy: flight.vy + GRAVITY * s,
        grounded: false,
        hits,
      });
      let at: readonly [number, number] = [first.x0, first.y0];
      let toss: Toss | null = null;
      let stage: Stage | null = null;
      let frame: MiniFrame | null = null;
      if (p <= AT.crouch) {
        // At rest on its words.
      } else if (tau < clock.thrown) {
        toss = down([press(first, 0)]);
      } else if (tau < clock.short) {
        at = feetAt(first, tau - clock.thrown);
        toss = up(first, tau - clock.thrown, [press(first, 0)]);
        stage = "flying";
      } else if (tau < clock.thrownAgain) {
        at = [first.x1, first.y1];
        stage = "input";
        if (tau < clock.short + SPRINGS) toss = down([landing(first, clock.short)]);
        else if (tau >= clock.crouchAgain) toss = down([press(second, clock.crouchAgain)]);
        else frame = playing("waiting", f.t);
      } else if (tau < clock.landed) {
        at = feetAt(second, tau - clock.thrownAgain);
        toss = up(second, tau - clock.thrownAgain, [press(second, clock.crouchAgain)]);
        stage = "flying";
      } else {
        at = [second.x1, second.y1];
        stage = p < AT.settles ? "landed" : "settled";
        if (tau < clock.cheers) toss = down([landing(second, clock.landed)]);
        // One cheer, played by the scroll; then it waits to be read.
        else if (tau < clock.calm) frame = playing("happy", tau - clock.cheers);
      }
      frame ??=
        toss === null ? playing("idle", f.t) : tossFrame(cell.look, toss, ms, points(scale));

      if (stage !== lit) {
        lit = stage;
        for (const li of stages) li.classList.toggle("on", li.dataset.stage === stage);
      }

      // The question: up while it waits, the answer shown as taken before it leaves.
      if (p < AT.asks) picked = null;
      asking = p >= AT.asks && p < AT.answered;
      const taken = picked ?? (p >= AT.taken ? 0 : null);
      if (card !== `${asking} ${taken}`) {
        card = `${asking} ${taken}`;
        ask.classList.toggle("on", asking);
        ask.classList.toggle("answered", taken !== null);
        ask.inert = !asking;
        options.forEach((option, n) => option.classList.toggle("taken", n === taken));
      }

      // Settling: it comes apart where it stands, then its letters go and line up.
      const going = span(p, AT.settles, AT.settles + 0.02),
        gone = span(p, AT.settles + 0.02, AT.settled);

      // Its label rides its head: the name, then the stage in the stage's tone.
      const named = ease.out(span(tau, clock.thrown, clock.thrown + 0.14));
      const word = stage === null ? "Flying" : `${stage[0]!.toUpperCase()}${stage.slice(1)}`;
      const base = at[1] - label.over - (toss === null ? 0 : (riseOf(frame) - label.rise) * scale);
      const nameWide = cell.name.length * label.wide,
        fullWide = nameWide + `${DOT}Flying`.length * label.wide;
      const left = at[0] - lerp(nameWide / 2, fullWide / 2, named);
      const labelAlpha = 1 - span(p, AT.settles, AT.settles + 0.04);
      const hintAlpha =
        span(p, AT.hint, AT.hint + 0.01) * (1 - span(p, AT.settles, AT.settles + 0.012));
      const hintWide = SETTLE_BY.length * label.wide;
      const hintLeft = clamp(
        at[0] - hintWide / 2,
        f.art.x + 2,
        f.art.x + f.art.width - hintWide - 2,
      );
      const hintBase = base - label.size - 7;
      const lineOf = (from: number, wide: number, baseline: number): Box => ({
        left: from,
        right: from + wide,
        top: baseline - label.size,
        bottom: baseline + 3,
      });
      const labelled = lineOf(left, nameWide + named * `${DOT}${word}`.length * label.wide, base),
        hinted = lineOf(hintLeft, hintWide, hintBase);
      /** How much of a trail's dot shows at (x, y): none under the words that ride with the Cell, however faint. */
      const under = (alpha: number, box: Box, x: number, y: number) =>
        1 - Math.min(1, alpha * 4) * (1 - clearOf(box, x, y));
      const shows = (x: number, y: number): number =>
        under(labelAlpha, labelled, x, y) * under(hintAlpha, hinted, x, y);

      // Where it asked stays marked in the ground once it has flown on.
      const asked = span(tau, clock.thrownAgain, clock.thrownAgain + 0.25);
      const mark: Box = {
        left: first.x1 - 5,
        right: first.x1 + 5,
        top: ground - 7,
        bottom: ground + 6,
      };
      const round = (x: number, y: number) => 1 - asked * (1 - clearOf(mark, x, y, 5));
      glyphs.clear();
      for (const x of lay.dots) glyphs.put("·", x, ground, 16, INK, 0.34 * round(x, ground));
      glyphs.put("?", first.x1, ground, 16, INK, 0.6 * asked);
      drawBody(glyphs, lay.words);
      drawBody(glyphs, lay.caption);
      drawBody(glyphs, lay.goal);
      lay.trails.forEach((trail, n) => {
        const began = n === 0 ? clock.thrown : clock.thrownAgain;
        for (const dot of trail) {
          const age = tau - began - dot.s;
          if (age <= 0) break;
          const fresh = Math.min(1, age / 0.05) * lerp(0.34, 0.85, Math.exp(-age / 0.3));
          glyphs.put("·", dot.x, dot.y, 24, INK, fresh * shows(dot.x, dot.y) * round(dot.x, dot.y));
        }
      });
      const line = DONE[picked ?? 0]!,
        lineWide = (line.length * lay.done.h) / 2;
      glyphs.text(
        line,
        clamp(lay.done.x - lineWide / 2, lay.done.left, lay.done.right - lineWide),
        lay.done.y,
        lay.done.h,
        INK,
        span(p, AT.landed + 0.02, AT.cheers) * 0.85 * (1 - span(p, AT.settles, AT.settles + 0.04)),
      );
      if (going > 0) {
        if (gone <= 0) drawBody(glyphs, lay.settle.from, going);
        else lay.settle.draw(glyphs, gone);
      }
      glyphs.flush();

      // The Cell and its label, on whole device pixels.
      context.clearRect(0, 0, cells.width, cells.height);
      if (going < 1)
        drawCell(context, cell, frame, {
          x: at[0] * d,
          y: at[1] * d,
          px: scale * d,
          alpha: 1 - going,
        });
      context.font = `500 ${label.size * d}px ${FONT}`;
      if (labelAlpha > 0)
        write(d, left, base, [
          [cell.name, NAME_INK, labelAlpha],
          [DOT, NAME_INK, labelAlpha * named],
          [word, TONE[stage ?? "flying"], labelAlpha * named],
        ]);
      if (hintAlpha > 0) write(d, hintLeft, hintBase, [[SETTLE_BY, HINT_INK, hintAlpha]]);
    },
    { still: STILL },
  );
}
