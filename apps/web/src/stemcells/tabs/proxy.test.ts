import { describe, expect, it } from "vite-plus/test";

import { BEGAN, ENDED, MAY_BEGIN, type ScrollPhases } from "./phases";
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
  const scroll = (slot: number) => turns.scrolled(slot, PIXEL);
  return {
    turns,
    scroll,
    /** A touch begins, over the proxy and going sideways unless `ours` says not. */
    touch(ours = true) {
      now += 100;
      turns.phases(phases(now, BEGAN, 0, 4, 0));
      turns.wheel(now, ours);
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
      turns.rested(slot);
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

  it("a touch only resting on the trackpad moves the walls too", () => {
    const { turns, scroll, land } = strip();
    scroll(REST_SLOT + 0.6);
    turns.aimed(REST_SLOT + 1);
    turns.phases(phases(50, MAY_BEGIN));
    expect(turns.origin).toBe(REST_SLOT + 1);
    // Its first move is the same touch, not another.
    turns.phases(phases(80, BEGAN, 0, 4, 0));
    expect(turns.origin).toBe(REST_SLOT + 1);
    land(REST_SLOT + 1);
    expect(turns.place).toBe(4);
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

describe("whatever the events and their order", () => {
  /** A seeded random source, so every run is the same. */
  function random(seed: number): () => number {
    let state = seed >>> 0;
    return () => {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      return state / 2 ** 32;
    };
  }

  it("nothing moves the walls but a new touch, the proxy's rest, a landing with the fingers up, or the one page a flick is owed", () => {
    for (let seed = 1; seed <= 200; seed++) {
      const next = random(seed);
      const turns = new Turns();
      turns.set(5, 11);
      let t = 0;
      let slot = REST_SLOT;
      let up = false;
      let paid = 0;
      for (let step = 0; step < 80; step++) {
        const roll = next();
        const before = { place: turns.place, origin: turns.origin };
        const stayed = () => expect({ place: turns.place, origin: turns.origin }).toEqual(before);
        t += 10;
        if (roll < 0.12) {
          turns.phases(phases(t, BEGAN, 0, 4, 0));
          turns.wheel(t, next() < 0.8);
          up = false;
          paid = 0;
        } else if (roll < 0.22) {
          turns.phases(phases(t, ENDED));
          if (next() < 0.7) turns.phases(phases(t + 1, 0, BEGAN, next() < 0.5 ? 30 : -30, 0));
          up = true;
          stayed();
        } else if (roll < 0.3) {
          turns.pay();
          expect(turns.origin).toBe(before.origin);
          paid += Math.abs(turns.place - before.place);
          expect(paid).toBeLessThanOrEqual(1);
        } else if (roll < 0.4) {
          turns.aimed(Math.round(slot + (next() - 0.5)));
          stayed();
        } else if (roll < 0.47) {
          turns.rested(Math.round(slot));
          slot = REST_SLOT;
          up = false;
          paid = 0;
        } else {
          // The proxy goes where fingers and coast take it: up to two slots at a go.
          slot = Math.min(Math.max(slot + (next() - 0.5) * 4, 1), 39);
          turns.scrolled(slot, PIXEL);
          if (!up) stayed();
        }
        // Within the walls the pages stand at most a page from the strip's own place.
        expect(Math.abs(offsetAt(turns.knots, slot))).toBeLessThanOrEqual(1);
      }
    }
  });
});
