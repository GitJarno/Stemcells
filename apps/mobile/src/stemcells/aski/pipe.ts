// The turn between a Cell's chat and Aski's (stemcells/tasks/aski-side.md): the figure heading
// the chat and the one in Aski's button each stand on an unseen pipe. They crouch, jump toward the
// person, go down it, and come out of the other's with some speed. How a figure stands at each
// moment, and how much of a chat's feed shows. Plain numbers: Reanimated runs them as worklets.

export const PIPE = {
  /** Crouch, jump and down the pipe. */
  dive: 320,
  /** The new chat is laid out before anything comes up. */
  settle: 40,
  /** Out the other end, and still. */
  rise: 460,
  /** The button's figure comes out a beat after the header's. */
  stagger: 70,
  /** A chat's feed and its title are gone by here. */
  feedOut: 240,
  /** And back in this long. */
  feedIn: 240,
} as const;

export interface Stance {
  /** Its size, 1 at rest. */
  readonly scale: number;
  /** Its height over its width: under 1 crouched, over 1 stretched. */
  readonly squash: number;
  /** Points down from its place. */
  readonly lift: number;
  readonly opacity: number;
}

/** How small a figure is at the pipe's mouth, and how far below its place. */
const MOUTH = { scale: 0.3, depth: 10 } as const;
/** The jump's top: toward the person, and up. */
const LEAP = { scale: 1.26, lift: -11 } as const;
/** Coming out: past its size and place, then back. */
const BURST = { scale: 1.18, lift: -8 } as const;
const CROUCH = { squash: 0.86, lift: 2 } as const;
const CROUCHED = 0.2;
const AT_TOP = 0.56;
const OUT = 0.4;

/** A figure going in, `ms` after the tap: at rest at 0, gone at `PIPE.dive`. */
export function leaving(ms: number): Stance {
  "worklet";
  const p = Math.min(1, Math.max(0, ms / PIPE.dive));
  if (p < CROUCHED) {
    const u = p / CROUCHED;
    const eased = u * (2 - u);
    return {
      scale: 1,
      squash: 1 + (CROUCH.squash - 1) * eased,
      lift: CROUCH.lift * eased,
      opacity: 1,
    };
  }
  if (p < AT_TOP) {
    const u = (p - CROUCHED) / (AT_TOP - CROUCHED);
    const eased = 1 - (1 - u) * (1 - u);
    return {
      scale: 1 + (LEAP.scale - 1) * eased,
      squash: CROUCH.squash + (1.08 - CROUCH.squash) * eased,
      lift: CROUCH.lift + (LEAP.lift - CROUCH.lift) * eased,
      opacity: 1,
    };
  }
  const u = (p - AT_TOP) / (1 - AT_TOP);
  const eased = u * u * u;
  return {
    scale: LEAP.scale + (MOUTH.scale - LEAP.scale) * eased,
    squash: 1.08 + (1 - 1.08) * u,
    lift: LEAP.lift + (MOUTH.depth - LEAP.lift) * eased,
    opacity: u < 0.7 ? 1 : 1 - (u - 0.7) / 0.3,
  };
}

/** A figure coming out, `ms` after it starts up: unseen at 0 (and before), at rest at `PIPE.rise`. */
export function arriving(ms: number): Stance {
  "worklet";
  const p = Math.min(1, Math.max(0, ms / PIPE.rise));
  if (p < OUT) {
    const u = p / OUT;
    const eased = 1 - (1 - u) * (1 - u) * (1 - u);
    return {
      scale: MOUTH.scale + (BURST.scale - MOUTH.scale) * eased,
      squash: 1 + 0.08 * eased,
      lift: MOUTH.depth + (BURST.lift - MOUTH.depth) * eased,
      opacity: Math.min(1, u / 0.3),
    };
  }
  // A swing that dies away, and is exactly still at the end.
  const u = (p - OUT) / (1 - OUT);
  const swing = Math.exp(-4.5 * u) * Math.cos(u * Math.PI * 2.2) * (1 - u);
  return {
    scale: 1 + (BURST.scale - 1) * swing,
    squash: 1 + 0.08 * swing,
    lift: BURST.lift * swing,
    opacity: 1,
  };
}

/** How much of the chat being left shows, `ms` after the tap. */
export function feedLeaving(ms: number): number {
  "worklet";
  const u = Math.min(1, Math.max(0, ms / PIPE.feedOut));
  return 1 - u * u * (3 - 2 * u);
}

/** How much of the chat arrived at shows, `ms` after it starts in. */
export function feedArriving(ms: number): number {
  "worklet";
  const u = Math.min(1, Math.max(0, ms / PIPE.feedIn));
  return u * u * (3 - 2 * u);
}
