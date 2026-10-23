// The lineage: every name a Cell has been dealt and the lives lived under
// it. A Cell's name is dealt from its chat's id (`cellNameOf`), and the
// names are few, so a name comes back: each chat that drew it is one life of
// the same avatar. Nothing is stored; the lives are the person's chats, the
// archived ones too, read again each time the page shows.

/** One chat that carried an avatar's name. */
export interface Life {
  /** `environmentId:threadId`, unique across machines. */
  readonly key: string;
  readonly threadId: string;
  readonly name: string;
  /** Its provider's driver (`claudeAgent`, `codex`, …), or null when unknown. */
  readonly driver: string | null;
  /** Its provider's name, as Settings › Providers says it. */
  readonly provider: string;
  readonly project: string;
  readonly title: string;
  /** Ms since the epoch: when its chat was made, and when it last changed. */
  readonly born: number;
  readonly lastSeen: number;
  readonly archived: boolean;
  /** Its turn runs now. */
  readonly running: boolean;
}

/** A name and every life lived under it, oldest first. */
export interface Avatar {
  readonly name: string;
  readonly lives: readonly Life[];
  readonly firstBorn: number;
  readonly lastSeen: number;
}

/** A life is still awake this long after its chat last changed. */
export const WARMTH_MS = 15 * 60_000;

/** Whether `life` is awake at `now`: at work, or its chat changed lately and isn't archived. */
export const isAwake = (life: Life, now: number): boolean =>
  !life.archived && (life.running || now - life.lastSeen < WARMTH_MS);

/** How long `life` lived: from its birth to when its chat last changed. */
export const livedMs = (life: Life): number => Math.max(0, life.lastSeen - life.born);

/** The lives gathered under their names, each avatar's oldest first, the most lives first. */
export function avatarsOf(lives: readonly Life[]): Avatar[] {
  const byName = new Map<string, Life[]>();
  for (const life of lives) byName.set(life.name, [...(byName.get(life.name) ?? []), life]);
  return [...byName]
    .map(([name, lived]) => {
      const ordered = lived.toSorted((a, b) => a.born - b.born || (a.key < b.key ? -1 : 1));
      return {
        name,
        lives: ordered,
        firstBorn: ordered[0]!.born,
        lastSeen: Math.max(...ordered.map((life) => life.lastSeen)),
      };
    })
    .sort(ORDERS.lives);
}

export type Order = "lives" | "newest" | "oldest";

const byName = (a: Avatar, b: Avatar) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0);

/** The collection's orders: the most lives, the latest seen, the first born; ties by name. */
export const ORDERS: Readonly<Record<Order, (a: Avatar, b: Avatar) => number>> = {
  lives: (a, b) => b.lives.length - a.lives.length || b.lastSeen - a.lastSeen || byName(a, b),
  newest: (a, b) => b.lastSeen - a.lastSeen || byName(a, b),
  oldest: (a, b) => a.firstBorn - b.firstBorn || byName(a, b),
};

/** The name reborn most often, when one has lived more than once. */
export function spotlightOf(avatars: readonly Avatar[]): Avatar | undefined {
  const first = avatars.toSorted(ORDERS.lives)[0];
  return first !== undefined && first.lives.length > 1 ? first : undefined;
}

const counted = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** "12 names · 31 lives · 2 awake". */
export function tallyOf(avatars: readonly Avatar[], now: number): string {
  const lives = avatars.flatMap((avatar) => avatar.lives);
  const awake = lives.filter((life) => isAwake(life, now)).length;
  return [
    counted(avatars.length, "name", "names"),
    counted(lives.length, "life", "lives"),
    `${awake} awake`,
  ].join(" · ");
}
