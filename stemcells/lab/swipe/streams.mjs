// Lab rig: phased trackpad streams, as "at_ms dx dy phase momentum" lines (CoreGraphics' codes).
const FINGER = 1000 / 120;
const COAST = 1000 / 60;

/**
 * One swipe: the fingers ramp up to `pace` px an event and travel `travel` px in all, lift,
 * and the system coasts from their last speed, keeping `decay` of it a frame. `direction` 1 goes
 * toward later pages. `coast: false` lifts from rest (no momentum). `axis: "y"` goes down the
 * page instead, and `wobble` is how far (px an event) the fingers stray across their way.
 */
export function swipe({
  at = 0,
  travel = 300,
  pace = 22,
  direction = 1,
  coast = true,
  decay = 0.92,
  axis = "x",
  wobble = 0,
}) {
  const move = (along, across) => (axis === "x" ? [along, across] : [across, along]);
  const events = [];
  let t = at;
  events.push([t, 0, 0, 128, 0]);
  t += FINGER;
  const ramp = [2, 5, 9, 13, 18];
  let moved = 0;
  let last = 0;
  let first = true;
  for (let i = 0; moved < travel; i++) {
    const step = Math.min(i < ramp.length ? Math.min(ramp[i], pace) : pace, travel - moved);
    moved += step;
    last = step;
    events.push([t, ...move(direction * step, i % 2 === 0 ? wobble : -wobble), first ? 1 : 2, 0]);
    first = false;
    t += FINGER;
  }
  events.push([t, 0, 0, 4, 0]);
  const lift = t;
  if (coast) {
    t += COAST;
    let speed = last * (COAST / FINGER) * decay;
    let begun = false;
    while (speed >= 1) {
      events.push([t, ...move(direction * Math.round(speed), 0), 0, begun ? 2 : 1]);
      begun = true;
      speed *= decay;
      t += COAST;
    }
    events.push([t, 0, 0, 0, 3]);
  }
  return { events, lift, end: t, travel: moved, direction };
}

/** A stream up to `at`, when fingers touch again: the system ends a coast still running there. */
export function cut(stream, at) {
  const events = stream.events.filter((e) => e[0] < at);
  const last = events.at(-1);
  if (last && last[4] !== 0 && last[4] !== 3) events.push([at - 1, 0, 0, 0, 3]);
  return { events };
}

/** Fingers that come to rest on the trackpad at `at` and lift `held` ms on without moving. */
export function rest({ at = 0, held = 120 }) {
  return {
    events: [
      [at, 0, 0, 128, 0],
      [at + held, 0, 0, 8, 0],
    ],
  };
}

export const lines = (events) =>
  events.map((e) => e.map((v) => (Number.isInteger(v) ? v : v.toFixed(2))).join(" ")).join("\n") +
  "\n";
