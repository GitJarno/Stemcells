import { describe, expect, it } from "vite-plus/test";

import { settledDuration, springAt, type Spring } from "../tokens/spring";
import { SwipeHand, type HeldStrip } from "./hand";
import { releaseVelocity } from "./pager";
import { LIFT_GAP, type WheelSample } from "./swipe";

// Swipes replayed through the hand the pager uses, against a strip that
// slides on the page spring: every swipe must turn exactly one page (or, a
// short one, none), never two, and the strip must never pass the page it
// goes to.

/** `--sc-motion-page`. */
const PAGE: Spring = { response: 0.5, damping: 1 };
const OMEGA = (2 * Math.PI) / PAGE.response;

/** A strip that slides like the app's, keeping a record of what it did. */
class ReplayStrip implements HeldStrip {
  now = 0;
  #position: number;
  #slide: { from: number; to: number; velocity: number; start: number; end: number } | null = null;
  #heading: number;
  /** The pages the strip turned to, in order. */
  readonly turns: number[] = [];
  /** How far (pages) the strip went past a page it was sliding to. */
  overshoot = 0;

  constructor(
    page: number,
    readonly pages: number,
    readonly pageWidth: number,
  ) {
    this.#position = page;
    this.#heading = page;
  }

  at(): number {
    const slide = this.#slide;
    if (slide === null) return this.#position;
    if (this.now >= slide.end) {
      this.#slide = null;
      this.#position = slide.to;
      return slide.to;
    }
    const progress = springAt(PAGE, (this.now - slide.start) / 1000, slide.velocity);
    const at = slide.from + (slide.to - slide.from) * progress;
    this.overshoot = Math.max(this.overshoot, (at - slide.to) * Math.sign(slide.to - slide.from));
    return at;
  }

  sliding(): boolean {
    this.at();
    return this.#slide !== null;
  }

  heading(): number {
    return this.#heading;
  }

  count(): number {
    return this.pages;
  }

  width(): number {
    return this.pageWidth;
  }

  grab(at: number): void {
    this.#slide = null;
    this.#position = at;
  }

  hold(position: number): void {
    this.#position = position;
  }

  release(from: number, to: number, pagesPerSecond: number): void {
    if (to !== this.#heading) this.turns.push(to);
    this.#heading = to;
    this.#position = to;
    if (Math.abs(to - from) < 1e-3) {
      this.#slide = null;
      return;
    }
    const velocity = releaseVelocity(from, to, pagesPerSecond, OMEGA);
    const duration = settledDuration(PAGE, velocity) * 1000;
    this.#slide = { from, to, velocity, start: this.now, end: this.now + duration };
    // Sample the slide densely for overshoot.
    for (let t = 0; t <= duration; t += 4) {
      const at = from + (to - from) * springAt(PAGE, t / 1000, velocity);
      this.overshoot = Math.max(this.overshoot, (at - to) * Math.sign(to - from));
    }
  }
}

/** A recorded swipe: the wheel events as the page got them, `[t, dx, dy, heard, got]`. */
interface Recording {
  readonly name: string;
  readonly note: string;
  readonly from: number;
  readonly count: number;
  readonly width: number;
  /** The way each swipe went: 1 a page on, -1 a page back, 0 too short to turn. */
  readonly turns: readonly number[];
  readonly events: readonly (readonly [number, number, number, number | null, number])[];
}

/**
 * Replays `events` through a hand holding a `ReplayStrip`. Between events
 * the page's lift timer fires, as in the app: `LIFT_GAP` after the page got
 * an event, unless the page was busy when it fell due (then input is
 * waiting by the time it runs, and it waits on).
 */
function replay(
  events: readonly WheelSample[],
  strip: ReplayStrip,
  hand = new SwipeHand(strip),
): ReplayStrip {
  let timer: number | null = null;
  for (const sample of events) {
    const got = sample.got ?? sample.t;
    if (timer !== null && got > timer && (sample.heard === undefined || timer < sample.heard)) {
      strip.now = timer;
      hand.idle(timer);
    }
    strip.now = got;
    hand.wheel(sample, () => false);
    timer = got + LIFT_GAP + 10;
  }
  if (timer !== null) {
    strip.now = timer;
    hand.idle(timer);
  }
  return strip;
}

const recordings = Object.values(
  import.meta.glob<Recording>("./swipes/*.json", { eager: true, import: "default" }),
);

describe("recorded swipes, as Chromium delivered them", () => {
  it.each(
    recordings.map((recording) => [`${recording.name}: ${recording.note}`, recording] as const),
  )("%s", (_, recording) => {
    const strip = new ReplayStrip(recording.from, recording.count, recording.width);
    const samples = recording.events.map(([t, dx, dy, heard, got]) => ({
      dx,
      dy,
      t,
      heard: heard ?? undefined,
      got,
    }));
    replay(samples, strip);
    let page = recording.from;
    const expected: number[] = [];
    for (const way of recording.turns) {
      const next = Math.min(Math.max(page + way, 0), recording.count - 1);
      if (next !== page) expected.push(next);
      page = next;
    }
    expect(strip.turns).toEqual(expected);
    expect(strip.overshoot * recording.width).toBeLessThan(1);
  });
});

// Swipes shaped like a Mac trackpad's, delivered the way Chromium delivers
// them: the fingers' events every 8 ms, then the system's coast every 17 ms
// decaying 5 % a frame, in whole pixels, each reaching the page a little
// after it came. A busy page hears nothing; what came meanwhile reaches it
// as one event per kind (fingers, coast) when it is free again, stamped
// with the last one's time. The browser, when busy itself, holds an event
// back, and what comes behind it arrives merged the same way.

/** One trackpad event: when, whether the fingers or the coast sent it, and how far (wheel sense). */
interface Pad {
  readonly t: number;
  readonly coast: boolean;
  readonly dx: number;
  /** The first event of a touch or of a coast, which the browser never merges with another. */
  readonly first?: boolean;
}

/** A flick a page on (`way` 1) or back (-1): fingers speeding up over `total` px, then the coast. */
function flick(at: number, way: 1 | -1, total = 160): Pad[] {
  const weights = Array.from({ length: 8 }, (_, i) => (i + 1) ** 1.3);
  const sum = weights.reduce((a, b) => a + b, 0);
  const steps = weights.map((w) => Math.max(1, Math.round((w / sum) * total)));
  const pads: Pad[] = steps.map((dx, i) => ({
    t: at + i * 8.3,
    coast: false,
    dx: way * dx,
    first: i === 0,
  }));
  const start = at + 7 * 8.3 + 25;
  let speed = steps.at(-1)! * 2;
  for (let t = start; Math.round(speed) >= 1; t += 16.7, speed *= 0.95) {
    pads.push({ t, coast: true, dx: way * Math.round(speed), first: t === start });
  }
  return pads;
}

/** A slow drag of `total` px that stops before the fingers lift: no coast. */
function drag(at: number, way: 1 | -1, total = 220): Pad[] {
  return Array.from({ length: 40 }, (_, i) => ({
    t: at + i * 8.3,
    coast: false,
    first: i === 0,
    dx:
      way *
      Math.max(1, Math.round((total / 40) * (0.6 + 0.8 * Math.sin((Math.PI * (i + 0.5)) / 40)))),
  }));
}

/** Swipes on one timeline: a touch stops the coast before it. */
function together(...swipes: Pad[][]): Pad[] {
  return swipes.flatMap((pads, i) => {
    const next = swipes[i + 1]?.[0]?.t ?? Infinity;
    return pads.filter((pad) => pad.t < next - 2);
  });
}

/** Times (ms) something is busy, and for how long. */
interface Busy {
  readonly at: readonly number[];
  readonly ms: number;
}

/** How long (ms) after an event the page usually gets it. */
const DELIVERY = 12;
/** How long (ms) a backlog takes per event: the browser hands the page the next once it has handled one. */
const DRAIN = 8;

/**
 * What the page gets of `pads` when it is busy (`page`, rendering a turn)
 * or the browser is (`browser`, holding back the event due next). What
 * comes meanwhile waits, each run of one kind (fingers, coast) merged into
 * one event stamped with its last one's time; the wait then drains one
 * event at a time, and what comes while it drains joins it. The first
 * event after the page was busy says when it went busy (`heard`).
 */
function delivered(
  pads: readonly Pad[],
  { page = { at: [], ms: 0 }, browser = { at: [], ms: 0 } }: { page?: Busy; browser?: Busy },
): WheelSample[] {
  const samples: WheelSample[] = [];
  const waiting: { pads: Pad[]; open: boolean }[] = [];
  let free = -Infinity;
  let heard: number | undefined;
  const drain = (until: number) => {
    while (waiting.length > 0 && free <= until) {
      const group = waiting.shift()!.pads;
      const dx = group.reduce((sum, pad) => sum + pad.dx, 0);
      samples.push({ dx, dy: 0, t: group.at(-1)!.t, heard, got: free });
      heard = undefined;
      free += DRAIN;
    }
  };
  for (const pad of pads) {
    drain(pad.t);
    const stall = page.at.find((at) => pad.t >= at && pad.t < at + page.ms);
    const hold = browser.at.find((at) => pad.t >= at && pad.t < at + browser.ms);
    if (stall !== undefined && free < stall + page.ms) {
      free = stall + page.ms;
      heard = stall - 4;
    }
    if (hold !== undefined && free < hold + browser.ms) free = hold + browser.ms;
    if (waiting.length === 0 && free <= pad.t) {
      samples.push({ dx: pad.dx, dy: 0, t: pad.t, got: pad.t + DELIVERY });
      continue;
    }
    const last = waiting.at(-1);
    if (last?.open && !pad.first && last.pads[0]!.coast === pad.coast) {
      last.pads.push(pad);
    } else {
      waiting.push({ pads: [pad], open: !pad.first });
    }
  }
  drain(Infinity);
  return samples;
}

/** Where each swipe's fingers lift, plus `after` ms: when the app renders the turn. */
function lifts(pads: readonly Pad[], after: number): number[] {
  return pads
    .filter((pad, i) => !pad.coast && pads[i + 1]?.coast !== false)
    .map((pad) => pad.t + after);
}

describe("swipes shaped like a trackpad's, on a page or browser that is sometimes busy", () => {
  const ways = (...turns: number[]) => turns;
  const cases: { name: string; pads: Pad[]; turns: number[] }[] = [
    { name: "one flick on", pads: flick(0, 1), turns: ways(1) },
    { name: "one flick back", pads: flick(0, -1), turns: ways(-1) },
    {
      name: "left, right, left, right, 300 ms apart",
      pads: together(flick(0, 1), flick(300, -1), flick(600, 1), flick(900, -1)),
      turns: ways(1, -1, 1, -1),
    },
    {
      name: "left, right, left, right, 200 ms apart",
      pads: together(flick(0, 1), flick(200, -1), flick(400, 1), flick(600, -1)),
      turns: ways(1, -1, 1, -1),
    },
    {
      name: "on, on, back, back, into the coast of the one before",
      pads: together(flick(0, 1), flick(350, 1), flick(700, -1), flick(1050, -1)),
      turns: ways(1, 1, -1, -1),
    },
    {
      name: "a slow drag, then one back",
      pads: together(drag(0, 1), drag(600, -1)),
      turns: ways(1, -1),
    },
    {
      name: "a long slow drag, then one back",
      pads: together(drag(0, 1, 400), drag(700, -1, 400)),
      turns: ways(1, -1),
    },
    {
      name: "a short flick springs home, and one back after it",
      pads: together(flick(0, 1, 70), flick(450, -1, 70)),
      turns: ways(0, 0),
    },
    {
      name: "a coast's tail, then a fresh swipe the same way",
      pads: together(flick(0, 1, 200), flick(1400, 1)),
      turns: ways(1, 1),
    },
  ];
  const runs = cases.flatMap(({ name, pads, turns }) => {
    // A wait longer than the time between two swipes hears them as one.
    const starts = pads.filter((pad) => pad.first && !pad.coast).map((pad) => pad.t);
    const between = Math.min(...starts.slice(1).map((t, i) => t - starts[i]!));
    const waits: { what: string; delivery: Parameters<typeof delivered>[1] }[] = [
      { what: "", delivery: {} },
      ...[60, 120, 250].map((ms) => ({
        what: `, the page busy ${ms} ms at each turn`,
        delivery: { page: { at: lifts(pads, 60), ms } },
      })),
      ...[100, 180].map((ms) => ({
        what: `, the browser holding each swipe's first event ${ms} ms`,
        delivery: { browser: { at: starts, ms } },
      })),
      ...[20, 150].map((after) => ({
        what: `, the browser holding what comes ${after} ms into each swipe 120 ms`,
        delivery: { browser: { at: starts.map((t) => t + after), ms: 120 } },
      })),
    ];
    return waits
      .filter(
        ({ delivery }) => Math.max(delivery.page?.ms ?? 0, delivery.browser?.ms ?? 0) < between,
      )
      .map(({ what, delivery }) => [`${name}${what}`, pads, turns, delivery] as const);
  });
  it.each(runs)("%s: one page a swipe", (_, pads, turns, delivery) => {
    const strip = new ReplayStrip(2, 5, 1200);
    replay(delivered(pads, delivery), strip);
    let page = 2;
    const expected: number[] = [];
    for (const way of turns) {
      if (way !== 0) expected.push((page += way));
    }
    expect(strip.turns).toEqual(expected);
    expect(strip.overshoot * 1200).toBeLessThan(1);
  });
});
