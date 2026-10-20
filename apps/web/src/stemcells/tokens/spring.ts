// Springs as the motion tokens define them: a response (seconds) and a
// damping ratio at unit mass, so stiffness = (2π / response)² and damping =
// 2 × ratio × (2π / response). The web has no springs, so each one is
// sampled here into a CSS linear() easing that runs for the spring's settled
// duration; the compositor then plays it like any other easing.
//
// A spring is released from rest, or with a velocity: the share of its move
// it covers per second at the moment of release. A page let go mid-swipe, or
// a move taken over by a newer one, starts with the speed it already has,
// so it carries on rather than stopping dead and setting off again.

export interface Spring {
  readonly response: number;
  readonly damping: number;
}

/** How far from its target a spring may be and still count as settled: a tenth of a percent of the move. */
export const SETTLED = 0.001;

/** Progress of a spring released at 0 toward 1, at time t (seconds), with `velocity` (moves per second; 0 is from rest). */
export function springAt({ response, damping }: Spring, t: number, velocity = 0): number {
  if (t <= 0) return 0;
  const omega = (2 * Math.PI) / response;
  const decay = Math.exp(-damping * omega * t);
  // The rest of the move is 1 at release and starts shrinking at `velocity`.
  const lead = damping * omega - velocity;
  if (damping < 1) {
    const wd = omega * Math.sqrt(1 - damping * damping);
    return 1 - decay * (Math.cos(wd * t) + (lead / wd) * Math.sin(wd * t));
  }
  if (damping === 1) return 1 - decay * (1 + lead * t);
  const wd = omega * Math.sqrt(damping * damping - 1);
  return 1 - decay * (Math.cosh(wd * t) + (lead / wd) * Math.sinh(wd * t));
}

const STEP = 0.0005;

/**
 * The spring's settled duration in seconds, to the millisecond: the end of
 * the last moment it is SETTLED or more away from its target.
 */
export function settledDuration(spring: Spring, velocity = 0): number {
  // The slowest term decays as e^(−rate·t). Past the time that term, scaled
  // well beyond its largest amplitude, takes to fall under SETTLED, with a
  // second to spare, the spring cannot stray that far again. A release
  // velocity adds to the amplitude in proportion to how fast it is.
  const omega = (2 * Math.PI) / spring.response;
  const z = spring.damping;
  const rate = z < 1 ? z * omega : (z - Math.sqrt(z * z - 1)) * omega;
  const amplitude =
    (z === 1 ? 2 : 1 / Math.sqrt(Math.abs(1 - z * z)) + 1) * 4 * (1 + Math.abs(velocity) / omega);
  const horizon = Math.log(amplitude / SETTLED) / rate + 1;
  let last = 0;
  for (let t = 0; t <= horizon; t += STEP) {
    if (Math.abs(1 - springAt(spring, t, velocity)) >= SETTLED) last = t;
  }
  return Math.ceil((last + STEP) * 1000) / 1000;
}

/** A point of an easing: progress through time (0…1) and the value there. */
export interface EasingPoint {
  readonly at: number;
  readonly value: number;
}

/**
 * The fewest points whose straight segments stay within `tolerance` of the
 * spring over its settled duration. Ends at exactly 1, so a transition lands
 * where it was sent.
 */
export function springEasing(spring: Spring, velocity = 0, tolerance = SETTLED): EasingPoint[] {
  const duration = settledDuration(spring, velocity);
  const n = Math.round(duration / STEP);
  const samples: EasingPoint[] = [];
  for (let i = 0; i <= n; i++) {
    samples.push({
      at: i / n,
      value: i === n ? 1 : springAt(spring, (i / n) * duration, velocity),
    });
  }
  return fewestPoints(samples, tolerance);
}

/**
 * The fewest of `points`, ordered in time, whose straight segments stay
 * within `tolerance` of every one of them. The first and the last are always
 * kept, so a move sampled this way starts and lands where it did.
 */
export function fewestPoints(points: readonly EasingPoint[], tolerance = SETTLED): EasingPoint[] {
  const last = points.length - 1;
  if (last < 1) return [...points];
  const keep = new Set<number>([0, last]);
  simplify(points, 0, last, tolerance, keep);
  return [...keep].sort((a, b) => a - b).map((i) => points[i]!);
}

// Splits a run at the sample farthest (in value) from the straight line
// across it until every sample is within tolerance of its segment.
function simplify(
  points: readonly EasingPoint[],
  from: number,
  to: number,
  tolerance: number,
  keep: Set<number>,
): void {
  const a = points[from]!;
  const b = points[to]!;
  let worst = -1;
  let worstError = tolerance;
  for (let i = from + 1; i < to; i++) {
    const p = points[i]!;
    const line = a.value + ((b.value - a.value) * (p.at - a.at)) / (b.at - a.at);
    const error = Math.abs(p.value - line);
    if (error > worstError) {
      worst = i;
      worstError = error;
    }
  }
  if (worst < 0) return;
  keep.add(worst);
  simplify(points, from, worst, tolerance, keep);
  simplify(points, worst, to, tolerance, keep);
}

const trim = (v: number, digits: number): string => String(Number(v.toFixed(digits)));

/** A spring as a CSS linear() easing, for use over its settled duration (`settledDuration` with the same velocity). */
export function cssLinear(spring: Spring, velocity = 0): string {
  const points = springEasing(spring, velocity);
  const stops = points.map((p, i) =>
    i === 0 || i === points.length - 1
      ? trim(p.value, 4)
      : `${trim(p.value, 4)} ${trim(p.at * 100, 2)}%`,
  );
  return `linear(${stops.join(", ")})`;
}
