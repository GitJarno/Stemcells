/**
 * Aski's button, in the words a person reads (stemcells/tasks/aski-side.md). One tap turns the
 * chat in front over to Aski and back; a long press holds what's next. The Mac and the phone
 * say it with these.
 */
export const ASKI_BUTTON = {
  /** The button, while a Cell or the home is in front. */
  toAski: "Aski",
  toAskiHint: "Turns over to Aski",
  /** While Aski is in front: back to `name` (a Cell), or to the home. */
  back: (name: string) => `Back to ${name}`,
  backHome: "Back to the home",
  /** Aski has answered since the person last looked. */
  answered: "Aski answered",
  menu: {
    fresh: "New Aski",
    freshHint: "Starts Aski afresh. The chat before settles, still readable.",
    cell: "New Cell",
    /** The next Cell waiting on the person, with how many wait. */
    input: (count: number) => `Next ask · ${count}`,
  },
  /** When a fresh Aski can't be made. */
  freshFailed: "Couldn't start a new Aski",
} as const;
