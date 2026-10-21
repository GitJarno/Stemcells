import { describe, expect, it } from "vite-plus/test";

import { PhasedContact, type ScrollPhases } from "./phases";
import { WheelContact, type WheelSample } from "./swipe";

// The system's phases place each wheel event: the fingers' moves turn the
// strip, the coast after the lift never does, and the strip lets go the
// moment the fingers lift. Without the phases followed, a short swipe rode
// the coast before it sprang home.

const MAY_BEGIN = 32;
const BEGAN = 1;
const CHANGED = 4;
const ENDED = 8;

const fingers = (t: number, phase = CHANGED): ScrollPhases => ({
  t,
  phase,
  momentum: 0,
  moved: true,
});
const touch = (t: number): ScrollPhases => ({ t, phase: MAY_BEGIN, momentum: 0, moved: false });
const lift = (t: number): ScrollPhases => ({ t, phase: ENDED, momentum: 0, moved: false });
const coast = (t: number, momentum = CHANGED): ScrollPhases => ({
  t,
  phase: 0,
  momentum,
  moved: momentum !== ENDED,
});
const wheel = (t: number, dx: number): WheelSample => ({ t, dx, dy: 0 });

describe("PhasedContact", () => {
  it("lets go the moment the system says the fingers lifted, and ignores the coast after", () => {
    const contact = new PhasedContact();
    contact.scroll(touch(0));
    contact.scroll(fingers(8, BEGAN));
    expect(contact.wheel(wheel(8, 10))).toEqual({ phase: "began", lifts: false });
    contact.scroll(fingers(16));
    expect(contact.wheel(wheel(16, 30))).toEqual({ phase: "moved", lifts: false });
    expect(contact.scroll(lift(24))).toEqual({ coasted: { dx: 0, dy: 0 } });
    contact.scroll(coast(41, BEGAN));
    expect(contact.wheel(wheel(41, 60))).toEqual({ phase: "coasting" });
    contact.scroll(coast(58));
    expect(contact.wheel(wheel(58, 55))).toEqual({ phase: "coasting" });
  });

  it("waits for the fingers' last move when the browser held it past the lift", () => {
    const contact = new PhasedContact();
    contact.scroll(touch(0));
    contact.scroll(fingers(8, BEGAN));
    contact.wheel(wheel(8, 10));
    contact.scroll(fingers(16));
    contact.scroll(fingers(24));
    expect(contact.scroll(lift(32))).toBeNull();
    // The two moves, merged and stamped with the last one's time.
    expect(contact.wheel(wheel(24, 50))).toEqual({ phase: "moved", lifts: true });
  });

  it("gives back coast moves taken as the fingers' before the lift reached the page", () => {
    const contact = new PhasedContact();
    contact.scroll(touch(0));
    contact.scroll(fingers(8, BEGAN));
    contact.wheel(wheel(8, 10));
    contact.scroll(fingers(16));
    contact.wheel(wheel(16, 30));
    // The coast's first event comes ahead of the phases that say the fingers lifted.
    expect(contact.wheel(wheel(41, 60))).toEqual({ phase: "moved", lifts: false });
    expect(contact.scroll(lift(24))).toEqual({ coasted: { dx: 60, dy: 0 } });
  });

  it("starts a new swipe when the fingers touch during the coast", () => {
    const contact = new PhasedContact();
    contact.scroll(touch(0));
    contact.scroll(fingers(8, BEGAN));
    contact.wheel(wheel(8, 40));
    contact.scroll(lift(16));
    contact.scroll(coast(33, BEGAN));
    expect(contact.wheel(wheel(33, 70))).toEqual({ phase: "coasting" });
    contact.scroll(coast(50, ENDED));
    contact.scroll(touch(52));
    contact.scroll(fingers(60, BEGAN));
    expect(contact.wheel(wheel(60, -4))).toEqual({ phase: "began", lifts: false });
  });

  it("reads a mouse wheel, which has no phases, from its wheel events after a trackpad swipe", () => {
    const contact = new PhasedContact();
    const alone = new WheelContact();
    contact.scroll(touch(0));
    contact.scroll(fingers(8, BEGAN));
    contact.wheel(wheel(8, 40));
    alone.wheel(wheel(8, 40));
    contact.scroll(lift(16));
    contact.scroll(coast(33, ENDED));
    expect(contact.wheel(wheel(1000, 12))).toEqual(alone.wheel(wheel(1000, 12)));
  });

  it("reads wheel events alone where there are no phases", () => {
    const contact = new PhasedContact();
    const alone = new WheelContact();
    for (const [t, dx] of [
      [0, 4],
      [8, 12],
      [16, 20],
      [24, 22],
    ] as const) {
      expect(contact.wheel(wheel(t, dx))).toEqual(alone.wheel(wheel(t, dx)));
    }
    expect(contact.idle(200)).toBe(alone.idle(200));
  });

  it("holds through a silence while the system says the fingers are still down", () => {
    const contact = new PhasedContact();
    contact.scroll(touch(0));
    contact.scroll(fingers(8, BEGAN));
    contact.wheel(wheel(8, 10));
    expect(contact.idle(300)).toBe(false);
  });
});
