import { describe, expect, it } from "vite-plus/test";

import { BEGAN, CANCELLED, ENDED, MAY_BEGIN, type ScrollPhases } from "./phases";
import { END_GIVE, keyed, offsetAt, REST_SLOT, Turns, walls } from "./proxy";

/** A pixel in slots, on a proxy 800 px wide. */
const PIXEL = 1 / 800;

describe("the knots", () => {
  it("follow the proxy one to one for a page either side, and no further", () => {
    const knots = walls(20, "page", "page");
    expect(offsetAt(knots, 20)).toBe(0);
    expect(offsetAt(knots, 20.3)).toBeCloseTo(0.3);
    expect(offsetAt(knots, 19.25)).toBeCloseTo(-0.75);
    // However far the proxy goes, the pages stand one page on.
    expect(offsetAt(knots, 22.6)).toBe(1);
    expect(offsetAt(knots, 3)).toBe(-1);
  });

  it("give a quarter of the move past an end, and come back to it", () => {
    const knots = walls(20, "end", "page");
    expect(offsetAt(knots, 19.8)).toBeCloseTo(-0.05);
    expect(offsetAt(knots, 19.5)).toBeCloseTo(-END_GIVE);
    // The slot the proxy snaps to past the end shows the end page again.
    expect(offsetAt(knots, 19)).toBe(0);
    expect(offsetAt(knots, 12)).toBe(0);
  });

  it("show nothing more on a walled side", () => {
    const knots = walls(20, "page", "wall");
    expect(offsetAt(knots, 20.7)).toBe(0);
    expect(offsetAt(knots, 19.5)).toBeCloseTo(-0.5);
  });

  it("key the whole track, level past the outer knots, clipped to it at its ends", () => {
    expect(keyed(walls(20, "page", "page"), 41)).toEqual([
      { at: 0, offset: -1 },
      { at: 19 / 40, offset: -1 },
      { at: 0.5, offset: 0 },
      { at: 21 / 40, offset: 1 },
      { at: 1, offset: 1 },
    ]);
    // On the track's last slot there is no slot on to key.
    expect(keyed(walls(40, "page", "page"), 41)).toEqual([
      { at: 0, offset: -1 },
      { at: 39 / 40, offset: -1 },
      { at: 1, offset: 0 },
    ]);
  });
});

const phases = (t: number, phase: number, momentum = 0, dx = 0, dy = 0): ScrollPhases => ({
  t,
  phase,
  momentum,
  moved: dx !== 0 || dy !== 0,
  dx,
  dy,
});

/** A strip of `count` pages on page `place`, and the proxy as the browser would move it. */
function strip(count = 7, place = 3) {
  const turns = new Turns();
  turns.set(place, count);
  let now = 0;
  /** The proxy scrolls to `slot`. */
  const scroll = (slot: number) => turns.scrolled(slot, PIXEL, now);
  return {
    turns,
    scroll,
    /** A touch begins, over the proxy and going sideways unless `ours` says not. */
    touch(ours = true) {
      now += 100;
      turns.wheel(now, ours);
      turns.phases(phases(now, BEGAN, 0, ours ? 4 : 0, ours ? 0 : 4));
    },
    /** Fingers come to rest on the trackpad, and move nothing. */
    rest() {
      now += 100;
      turns.phases(phases(now, MAY_BEGIN));
    },
    lift() {
      now += 100;
      turns.phases(phases(now, ENDED));
    },
    /** The fingers lift and the coast sets off `dx`, `dy` a frame. */
    flick(dx: number, dy = 0) {
      now += 100;
      turns.phases(phases(now, ENDED));
      turns.phases(phases(now + 8, 0, BEGAN, dx, dy));
    },
    /** The proxy goes to `slot` by its snap, and rests there. */
    land(slot: number) {
      turns.aimed(slot);
      scroll(slot);
      now += 100;
      turns.rested(slot, now);
    },
    /** What is on screen with the proxy on `slot`. */
    shown: (slot: number) => turns.place + offsetAt(turns.knots, slot),
  };
}

describe("one touch", () => {
  it("turns one page when the proxy snaps a slot on", () => {
    const { turns, scroll, land, shown } = strip();
    scroll(REST_SLOT + 0.4);
    expect(shown(REST_SLOT + 0.4)).toBeCloseTo(3.4);
    turns.aimed(REST_SLOT + 1);
    expect(turns.heading).toBe(4);
    land(REST_SLOT + 1);
    expect(turns.place).toBe(4);
    expect(turns.origin).toBe(REST_SLOT);
    expect(turns.resting).toBe(true);
  });

  it("turns one page however far it carries the proxy", () => {
    // A hard swipe drags the proxy past the next slot, and its coast lands on the one after.
    const { turns, scroll, land, shown } = strip();
    scroll(REST_SLOT + 1.3);
    expect(shown(REST_SLOT + 1.3)).toBe(4);
    turns.aimed(REST_SLOT + 2);
    expect(turns.heading).toBe(4);
    land(REST_SLOT + 2);
    expect(turns.place).toBe(4);
  });

  it("goes nowhere at the strip's end, wherever the proxy lands", () => {
    const { turns, land, shown } = strip(7, 6);
    expect(shown(REST_SLOT + 0.5)).toBeCloseTo(6 + END_GIVE);
    land(REST_SLOT + 1);
    expect(turns.place).toBe(6);
  });

  it("has landed once the proxy is on its target to the pixel", () => {
    const { turns, scroll } = strip();
    scroll(REST_SLOT + 0.5);
    turns.aimed(REST_SLOT + 1);
    expect(turns.landed(PIXEL)).toBe(false);
    scroll(REST_SLOT + 1 - PIXEL / 2);
    expect(turns.landed(PIXEL)).toBe(true);
  });
});

describe("a second touch while the strip is in flight", () => {
  it("can take it one page further than the page it was headed for", () => {
    const { turns, scroll, touch, lift, land, shown } = strip();
    touch();
    scroll(REST_SLOT + 0.4);
    lift();
    turns.aimed(REST_SLOT + 1);
    scroll(REST_SLOT + 0.8);
    // The walls move to the page it is headed for; what is on screen stays where it is.
    const before = shown(REST_SLOT + 0.8);
    touch();
    expect(turns.place).toBe(4);
    expect(turns.origin).toBe(REST_SLOT + 1);
    expect(shown(REST_SLOT + 0.8)).toBeCloseTo(before);
    scroll(REST_SLOT + 1.4);
    expect(shown(REST_SLOT + 1.4)).toBeCloseTo(4.4);
    land(REST_SLOT + 2);
    expect(turns.place).toBe(5);
  });

  it("without the system's word that a touch began, the walls stay until the proxy rests", () => {
    // A browser: nothing says a second touch began, so nothing is taken for one. This is the
    // skip: a coast the busy page heard late was read as fingers, and turned a second page.
    const { turns, scroll, land, shown } = strip();
    scroll(REST_SLOT + 0.4);
    turns.aimed(REST_SLOT + 1);
    scroll(REST_SLOT + 1.6);
    expect(shown(REST_SLOT + 1.6)).toBe(4);
    land(REST_SLOT + 2);
    expect(turns.place).toBe(4);
  });

  it("that only rests on the trackpad moves nothing: the walls wait for it to move the proxy", () => {
    const { turns, scroll, touch, lift, rest, land } = strip();
    touch();
    scroll(REST_SLOT + 0.4);
    lift();
    turns.aimed(REST_SLOT + 1);
    scroll(REST_SLOT + 0.6);
    rest();
    expect(turns.origin).toBe(REST_SLOT);
    // Its first move is the same touch, and now the proxy is its own.
    turns.wheel(1000, true);
    turns.phases(phases(1000, BEGAN, 0, 4, 0));
    expect(turns.origin).toBe(REST_SLOT + 1);
    expect(turns.place).toBe(4);
    land(REST_SLOT + 1);
    expect(turns.place).toBe(4);
  });

  it("that moves nothing of the proxy's leaves a paid page's wall up", () => {
    // Under load: the flick was paid before the page heard where the proxy was going, fingers
    // came to rest, and the proxy landed a slot on after all. Counted again, it turned two pages.
    for (const second of ["rest", "elsewhere"] as const) {
      const { turns, scroll, touch, rest, flick, land, shown } = strip();
      touch();
      scroll(REST_SLOT + 0.3);
      flick(40);
      turns.pay();
      expect(turns.place).toBe(4);
      if (second === "rest") rest();
      else touch(false);
      expect(shown(REST_SLOT + 0.8)).toBe(4);
      land(REST_SLOT + 1);
      expect(turns.place).toBe(4);
    }
  });

  it("is a new touch even if the last one's lift never reached the page", () => {
    const { turns, scroll, touch, land } = strip();
    touch();
    scroll(REST_SLOT + 0.4);
    turns.aimed(REST_SLOT + 1);
    scroll(REST_SLOT + 0.9);
    touch();
    expect(turns.origin).toBe(REST_SLOT + 1);
    land(REST_SLOT + 2);
    expect(turns.place).toBe(5);
  });

  it("heard late, after the proxy passed the wall, still gives that touch its page", () => {
    const { turns, scroll, touch, lift, land } = strip();
    touch();
    scroll(REST_SLOT + 0.5);
    lift();
    turns.aimed(REST_SLOT + 1);
    // The second touch has carried the proxy past the page; the page hears of it only now.
    scroll(REST_SLOT + 1.3);
    touch();
    expect(turns.place).toBe(4);
    expect(turns.origin).toBe(REST_SLOT + 1);
    land(REST_SLOT + 2);
    expect(turns.place).toBe(5);
  });
});

describe("a flick", () => {
  it("that the browser's snap takes a page on is owed nothing", () => {
    const { turns, scroll, touch, flick, land } = strip();
    touch();
    scroll(REST_SLOT + 0.3);
    flick(40);
    turns.aimed(REST_SLOT + 1);
    expect(turns.owing).toBe(true);
    turns.pay();
    expect(turns.owing).toBe(false);
    expect(turns.place).toBe(3);
    land(REST_SLOT + 1);
    expect(turns.place).toBe(4);
  });

  it("that the snap leaves on the page it was headed for is owed the next", () => {
    // The second of two quick swipes lifts before the proxy has reached the first one's page:
    // the browser lands it there. A second swipe is a second page.
    const { turns, scroll, touch, flick, land, shown } = strip();
    touch();
    scroll(REST_SLOT + 0.3);
    flick(40);
    turns.aimed(REST_SLOT + 1);
    turns.pay();
    scroll(REST_SLOT + 0.5);
    touch();
    scroll(REST_SLOT + 0.8);
    flick(40);
    turns.pay();
    expect(turns.place).toBe(5);
    expect(turns.heading).toBe(5);
    // The proxy still has its way to go, and takes the strip no further than that.
    expect(shown(REST_SLOT + 0.8)).toBeCloseTo(4.8);
    expect(shown(REST_SLOT + 1.7)).toBe(5);
    land(REST_SLOT + 1);
    expect(turns.place).toBe(5);
  });

  it("is owed its page once, even if the proxy goes a slot on after all", () => {
    // The page had not yet heard where the proxy was going when it paid.
    const { turns, scroll, touch, flick, land } = strip();
    touch();
    scroll(REST_SLOT + 0.3);
    flick(40);
    turns.pay();
    expect(turns.place).toBe(4);
    turns.aimed(REST_SLOT + 1);
    turns.pay();
    land(REST_SLOT + 1);
    expect(turns.place).toBe(4);
  });

  it("back is owed the page before", () => {
    const { turns, scroll, touch, flick, land } = strip();
    touch();
    scroll(REST_SLOT + 0.2);
    flick(-40);
    turns.pay();
    expect(turns.place).toBe(2);
    land(REST_SLOT);
    expect(turns.place).toBe(2);
  });

  it("is owed nothing past the strip's end", () => {
    const { turns, scroll, touch, flick } = strip(7, 6);
    touch();
    scroll(REST_SLOT + 0.2);
    flick(40);
    turns.pay();
    expect(turns.place).toBe(6);
  });

  it("up or down is no flick of the strip's", () => {
    const { turns, touch, flick } = strip();
    touch();
    flick(3, 40);
    expect(turns.owing).toBe(false);
  });

  it("of a touch that scrolled something else is owed nothing", () => {
    // The strip is still landing when the fingers flick a wide code block, or the column.
    const { turns, scroll, touch, flick, land } = strip();
    touch();
    scroll(REST_SLOT + 0.4);
    flick(40);
    turns.aimed(REST_SLOT + 1);
    turns.pay();
    scroll(REST_SLOT + 0.7);
    touch(false);
    flick(40);
    turns.pay();
    land(REST_SLOT + 1);
    expect(turns.place).toBe(4);
  });
});

describe("a flick the page hears late", () => {
  it("after the proxy brought its page and rested, is owed nothing", () => {
    // The skip while a chat streams: the lift and the coast were heard a second and a half
    // late, after the page had landed, and the flick was paid a second page.
    const { turns, scroll, touch, flick, land } = strip();
    touch();
    scroll(REST_SLOT + 0.4);
    land(REST_SLOT + 1);
    expect(turns.place).toBe(4);
    flick(40);
    expect(turns.owing).toBe(true);
    turns.pay();
    expect(turns.place).toBe(4);
  });

  it("with its whole touch, after the page turned, is owed nothing", () => {
    const { turns, scroll, land } = strip();
    turns.wheel(50, true);
    scroll(REST_SLOT + 0.4);
    land(REST_SLOT + 1);
    turns.phases(phases(50, BEGAN, 0, 4, 0));
    turns.phases(phases(60, ENDED));
    turns.phases(phases(68, 0, BEGAN, 40, 0));
    turns.pay();
    expect(turns.place).toBe(4);
  });

  it("after the proxy came back and rested, is still owed its page, and leaves no wall behind", () => {
    const { turns, scroll, touch, flick, land, shown } = strip();
    touch();
    scroll(REST_SLOT + 0.2);
    land(REST_SLOT);
    flick(40);
    turns.pay();
    expect(turns.place).toBe(4);
    // The next swipe has both sides to go to.
    expect(shown(REST_SLOT + 0.5)).toBeCloseTo(4.5);
  });

  it("when the next touch has already begun, is settled then", () => {
    const { turns, scroll, touch, flick, land } = strip();
    touch();
    scroll(REST_SLOT + 0.4);
    land(REST_SLOT + 1);
    flick(40);
    // Nothing paid it yet when the second touch is heard: the page that came is the first's.
    touch();
    flick(40);
    turns.pay();
    expect(turns.place).toBe(5);
  });
});

describe("landing", () => {
  it("with the fingers known to be up, the walls go round the page landed on at once", () => {
    // The proxy creeps its last fraction of a pixel for a while before it says it rests; a
    // touch in that while is on the page already.
    const { turns, scroll, touch, flick, shown } = strip();
    touch();
    scroll(REST_SLOT + 0.3);
    flick(40);
    turns.aimed(REST_SLOT + 1);
    turns.pay();
    scroll(REST_SLOT + 1 - PIXEL / 2);
    expect(turns.place).toBe(4);
    expect(turns.origin).toBe(REST_SLOT + 1);
    expect(shown(REST_SLOT + 1.5)).toBeCloseTo(4.5);
  });

  it("with the fingers perhaps still down, they wait for the rest", () => {
    const { turns, scroll } = strip();
    scroll(REST_SLOT + 0.3);
    turns.aimed(REST_SLOT + 1);
    scroll(REST_SLOT + 1);
    expect(turns.place).toBe(3);
    expect(turns.origin).toBe(REST_SLOT);
  });
});

describe("a turn by other means while the fingers hold the proxy", () => {
  it("shows nothing of the proxy until a new touch or its rest", () => {
    const { turns, scroll, touch, land, shown } = strip();
    touch();
    scroll(REST_SLOT + 0.4);
    turns.spend();
    turns.set(0, 7);
    expect(shown(REST_SLOT + 0.4)).toBe(0);
    expect(shown(REST_SLOT + 1)).toBe(0);
    land(REST_SLOT + 1);
    expect(turns.place).toBe(0);
    expect(shown(REST_SLOT + 0.5)).toBeCloseTo(0.5);
  });

  it("at rest changes nothing but the page", () => {
    const { turns, shown } = strip();
    turns.spend();
    turns.set(5, 7);
    expect(shown(REST_SLOT + 0.5)).toBeCloseTo(5.5);
  });
});

/**
 * One story of the fingers and the proxy, as it truly happened, heard by the page in every order
 * the app can hear it in. The page's own events (wheel, scroll, snap target, rest) come in their
 * order and the system's phases in theirs, each as late as a busy page makes them, the phases
 * later still: they queue behind the page's other work.
 */
interface Told {
  readonly at: number;
  readonly from: "page" | "system";
  readonly flicks?: boolean;
  readonly hear: (turns: Turns, now: number) => void;
}

const R = REST_SLOT;
const wheel = (at: number, ours = true): Told => ({
  at,
  from: "page",
  hear: (turns) => turns.wheel(at, ours),
});
const scroll = (at: number, slot: number): Told => ({
  at,
  from: "page",
  hear: (turns, now) => turns.scrolled(slot, PIXEL, now),
});
const aim = (at: number, slot: number): Told => ({
  at,
  from: "page",
  hear: (turns) => turns.aimed(slot),
});
const rest = (at: number, slot: number): Told => ({
  at,
  from: "page",
  hear: (turns, now) => turns.rested(slot, now),
});
const phase = (at: number, phase: number, dx = 0, dy = 0): Told => ({
  at,
  from: "system",
  hear: (turns) => turns.phases(phases(at, phase, 0, dx, dy)),
});
const coast = (at: number, dx: number, dy = 0): Told => ({
  at,
  from: "system",
  flicks: true,
  hear: (turns) => turns.phases(phases(at, 0, BEGAN, dx, dy)),
});

/** A flick the browser's snap takes a slot on, from `t`. */
const flickOn = (t = 0): Told[] => [
  wheel(t),
  phase(t, BEGAN, 4),
  scroll(t + 16, R + 0.1),
  scroll(t + 60, R + 0.3),
  phase(t + 100, ENDED),
  coast(t + 108, 30),
  scroll(t + 116, R + 0.45),
  scroll(t + 130, R + 0.55),
  aim(t + 130, R + 1),
  scroll(t + 220, R + 0.8),
];
const landsOn = (t: number): Told[] => [scroll(t + 400, R + 1), rest(t + 560, R + 1)];

const STORIES: { readonly name: string; readonly told: Told[]; readonly pages: number }[] = [
  { name: "a flick the snap takes a slot on", told: [...flickOn(), ...landsOn(0)], pages: 1 },
  {
    name: "a flick the snap leaves short",
    told: [
      wheel(0),
      phase(0, BEGAN, 4),
      scroll(40, R + 0.15),
      phase(80, ENDED),
      coast(88, 20),
      scroll(100, R + 0.25),
      scroll(250, R + 0.1),
      scroll(380, R),
      rest(540, R),
    ],
    pages: 1,
  },
  {
    name: "a hard flick that lands two slots on",
    told: [
      wheel(0),
      phase(0, BEGAN, 4),
      scroll(40, R + 0.6),
      aim(40, R + 1),
      scroll(90, R + 1.2),
      phase(100, ENDED),
      coast(108, 60),
      scroll(130, R + 1.6),
      aim(130, R + 2),
      scroll(450, R + 2),
      rest(610, R + 2),
    ],
    pages: 1,
  },
  {
    name: "a flick, then fingers resting on the trackpad as it lands",
    told: [
      ...flickOn(),
      phase(230, MAY_BEGIN),
      ...landsOn(0).slice(0, 1),
      phase(480, CANCELLED),
      rest(560, R + 1),
    ],
    pages: 1,
  },
  {
    name: "a flick, then fingers resting before the proxy is past the middle",
    told: [
      wheel(0),
      phase(0, BEGAN, 4),
      scroll(50, R + 0.2),
      phase(80, ENDED),
      coast(88, 30),
      scroll(110, R + 0.4),
      phase(120, MAY_BEGIN),
      scroll(140, R + 0.55),
      aim(140, R + 1),
      scroll(400, R + 1),
      phase(450, CANCELLED),
      rest(560, R + 1),
    ],
    pages: 1,
  },
  {
    name: "a flick, then a flick of something else as it lands",
    told: [
      ...flickOn(),
      wheel(240, false),
      phase(240, BEGAN, 4),
      phase(330, ENDED),
      coast(338, 40),
      ...landsOn(0),
    ],
    pages: 1,
  },
  {
    name: "a slow drag past the middle, let go",
    told: [
      wheel(0),
      phase(0, BEGAN, 4),
      scroll(150, R + 0.3),
      scroll(300, R + 0.6),
      aim(300, R + 1),
      scroll(400, R + 0.7),
      phase(450, ENDED),
      scroll(700, R + 1),
      rest(860, R + 1),
    ],
    pages: 1,
  },
  {
    name: "a nudge",
    told: [
      wheel(0),
      phase(0, BEGAN, 4),
      scroll(50, R + 0.1),
      phase(100, ENDED),
      scroll(250, R),
      rest(400, R),
    ],
    pages: 0,
  },
  {
    name: "two swipes, a rest between",
    told: [...flickOn(), ...landsOn(0), ...flickOn(1000), ...landsOn(1000)],
    pages: 2,
  },
  {
    name: "two quick flicks",
    told: [
      ...flickOn(),
      wheel(240),
      phase(240, BEGAN, 4),
      scroll(280, R + 1.1),
      phase(320, ENDED),
      coast(328, 30),
      scroll(340, R + 1.4),
      scroll(370, R + 1.6),
      aim(370, R + 2),
      scroll(600, R + 2),
      rest(760, R + 2),
    ],
    pages: 2,
  },
];

describe("whenever the page hears of them", () => {
  /** A seeded random source, so every run is the same. */
  function random(seed: number): () => number {
    let state = seed >>> 0;
    return () => {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      return state / 2 ** 32;
    };
  }

  /** How late (ms) the page's own events come, and how much later still the system's phases. */
  const PAGE_LATE = [0, 0, 16, 120, 500];
  const SYSTEM_LATE = [0, 8, 60, 400, 2000];
  /** A phase is never heard before the page's events from this long (ms) before it. */
  const LEAD = 50;

  /** The story in the order the page hears it, each flick's page settled once the page has caught up with it. */
  function heard(told: readonly Told[], next: () => number) {
    const pick = (lates: readonly number[]) => lates[Math.floor(next() * lates.length)]!;
    const order: { when: number; rank: number; hear: (turns: Turns) => void }[] = [];
    const page: { at: number; when: number }[] = [];
    /** When the page has heard all of its own events up to `at`. */
    const caughtUp = (at: number) => page.findLast((event) => event.at <= at)?.when ?? 0;
    let last = 0;
    for (const event of told.filter((event) => event.from === "page")) {
      last = Math.max(last, event.at + pick(PAGE_LATE));
      const when = last;
      page.push({ at: event.at, when });
      order.push({ when, rank: 0, hear: (turns) => event.hear(turns, when) });
    }
    last = 0;
    for (const event of told.filter((event) => event.from === "system")) {
      last = Math.max(last, event.at + pick(SYSTEM_LATE), caughtUp(event.at - LEAD));
      const when = last;
      order.push({ when, rank: 1, hear: (turns) => event.hear(turns, when) });
      // Two frames on, the page has heard where the proxy was when it heard the flick.
      if (event.flicks) {
        order.push({ when: Math.max(when, caughtUp(when)), rank: 2, hear: (turns) => turns.pay() });
      }
    }
    return order.toSorted((a, b) => a.when - b.when || a.rank - b.rank);
  }

  it.each(STORIES)("$name turns the pages it should", ({ told, pages }) => {
    for (let seed = 1; seed <= 400; seed++) {
      const turns = new Turns();
      turns.set(5, 11);
      for (const event of heard(told, random(seed))) {
        event.hear(turns);
        // Within the walls the pages stand at most a page from the strip's own place.
        for (const knot of turns.knots) expect(Math.abs(knot.offset)).toBeLessThanOrEqual(1);
      }
      expect(turns.place - 5, `seed ${seed}`).toBe(pages);
      expect(turns.resting).toBe(true);
    }
  });
});
