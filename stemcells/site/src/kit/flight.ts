// A throw in closed form: where its feet are at any moment, so a scene can
// play it forwards and backwards from the scroll alone.

/** A toss falls this fast, CSS px a second², as the app's own (`cell/toss.ts`). */
export const GRAVITY = 1400;

export interface Flight {
  readonly x0: number;
  readonly y0: number;
  readonly x1: number;
  readonly y1: number;
  readonly vx: number;
  readonly vy: number;
  readonly time: number;
}

/** The throw from one place to another whose feet pass `apex` at the top. */
export function flightOver(x0: number, y0: number, x1: number, y1: number, apex: number): Flight {
  const up = Math.sqrt((2 * (y0 - apex)) / GRAVITY),
    down = Math.sqrt((2 * (y1 - apex)) / GRAVITY);
  const time = up + down;
  return { x0, y0, x1, y1, vx: (x1 - x0) / time, vy: -GRAVITY * up, time };
}

/** Where its feet are `s` seconds into `flight`. */
export const feetAt = (flight: Flight, s: number): readonly [number, number] => [
  flight.x0 + flight.vx * s,
  flight.y0 + flight.vy * s + 0.5 * GRAVITY * s * s,
];

export interface TrailDot {
  readonly x: number;
  readonly y: number;
  /** Seconds into the flight when the feet pass it. */
  readonly s: number;
}

/** A flight's path as dots `gap` apart along it. */
export function trailOf(flight: Flight, gap: number): TrailDot[] {
  const dots: TrailDot[] = [];
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
