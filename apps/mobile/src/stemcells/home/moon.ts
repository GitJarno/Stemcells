// The moon over the Asleep tab, at its real phase: how far into its month
// it is, and the lit part as an SVG path. A mean synodic month from a known
// new moon is within a day of the sky, which is all a drawing needs.

/** A new moon: 2000-01-06 18:14 UTC. */
const NEW_MOON_MS = Date.UTC(2000, 0, 6, 18, 14);
const SYNODIC_DAYS = 29.530588853;
const DAY_MS = 86_400_000;

/** How far into its month the moon is at `ms`: 0 new, 0.5 full, toward 1 new again. */
export function moonPhase(ms: number): number {
  const days = (ms - NEW_MOON_MS) / DAY_MS;
  return (((days / SYNODIC_DAYS) % 1) + 1) % 1;
}

/**
 * The lit part of a moon of radius `r` centred on the origin at `phase`, as
 * seen from the north: it waxes from the right. One edge is the limb, a half
 * circle; the other the terminator, a half ellipse whose width follows the
 * phase.
 */
export function litPath(phase: number, r: number): string {
  const waxing = phase < 0.5;
  // How far the terminator bows, from -r (new) through 0 (half) to r (full).
  const bow = -Math.cos(phase * 2 * Math.PI) * r;
  const limb = waxing ? 1 : 0;
  const terminator = bow > 0 === waxing ? 1 : 0;
  return `M0 ${-r}A${r} ${r} 0 0 ${limb} 0 ${r}A${Math.abs(bow)} ${r} 0 0 ${terminator} 0 ${-r}Z`;
}
