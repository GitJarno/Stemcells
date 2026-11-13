// A read against a change on its way to the machine: an answer from before the change arrived
// would put back what the person just chose. Pure.

export interface Turns {
  /** A read begins; what it returns says, as the answer lands, whether to take it. */
  readonly read: () => () => boolean;
  /** A change begins; call what it returns once the machine has it. */
  readonly change: () => () => void;
}

/** A read is taken only when no change was on its way at any time while it ran. */
export function turns(): Turns {
  let pending = 0;
  let arrived = 0;
  return {
    read: () => {
      const at = arrived;
      return () => pending === 0 && at === arrived;
    },
    change: () => {
      pending += 1;
      return () => {
        pending -= 1;
        arrived += 1;
      };
    },
  };
}
