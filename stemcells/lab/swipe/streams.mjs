// Lab rig: phased trackpad streams, as "at_ms dx dy phase momentum" lines (CoreGraphics' codes).
const FINGER = 1000 / 120;
const COAST = 1000 / 60;

/**
 * One swipe: the fingers ramp up to `pace` px an event and travel `travel` px in all, lift,
 * and the system coasts from their last speed, keeping `decay` of it a frame. `direction` 1 goes
 * toward later pages. `coast: false` lifts from rest (no momentum).
 */
export function swipe({
  at = 0,
  travel = 300,
  pace = 22,
  direction = 1,
  coast = true,
  decay = 0.92,
  dy = 0,
}) {
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
    events.push([t, direction * step, dy, first ? 1 : 2, 0]);
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
      events.push([t, direction * Math.round(speed), 0, 0, begun ? 2 : 1]);
      begun = true;
      speed *= decay;
      t += COAST;
    }
    events.push([t, 0, 0, 0, 3]);
  }
  return { events, lift, end: t, travel: moved, direction };
}

export const lines = (events) =>
  events.map((e) => e.map((v) => (Number.isInteger(v) ? v : v.toFixed(2))).join(" ")).join("\n") +
  "\n";
