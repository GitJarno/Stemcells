// The lineage: every name a Cell has been dealt and the lives lived under
// it. A Cell's name is dealt from its chat's id (`cellNameOf`), and the
// names are few, so a name comes back: each chat that drew it is one life of
// the same avatar. Nothing is stored; the lives are the person's chats, the
// archived ones too, read again each time the page shows. What a life spent
// is its chat's turns as its provider counted them, so a name's spend is
// its lives' added up.

/** What one chat spent (`GET /api/stemcells/spend`). */
export interface Spend {
  readonly tokens: number;
  readonly inputTokens: number;
  readonly cachedInputTokens: number;
  readonly outputTokens: number;
  /** At list price, in US dollars; null when no model it ran had a price. */
  readonly costUsd: number | null;
  /** Short of the whole: a turn left uncounted, unpriced, or subagents left out. */
  readonly short: boolean;
}

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
  /** What it spent, when its machine counted it. */
  readonly spend?: Spend;
}

/** A name and every life lived under it, oldest first. */
export interface Avatar {
  readonly name: string;
  readonly lives: readonly Life[];
  readonly firstBorn: number;
  readonly lastSeen: number;
  /** Its counted lives' spend added up, or null when none was counted. */
  readonly spend: Spend | null;
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
        spend: spendOf(ordered),
      };
    })
    .sort(ORDERS.lives);
}

/**
 * `lives`' spend added up, or null when none was counted. Short when one of
 * them was, or when a life went uncounted (its chat older than the count, or
 * on a machine this page can't ask).
 */
export function spendOf(lives: readonly Life[]): Spend | null {
  const counted = lives.flatMap((life) => (life.spend === undefined ? [] : [life.spend]));
  if (counted.length === 0) return null;
  const sum = (field: "tokens" | "inputTokens" | "cachedInputTokens" | "outputTokens") =>
    counted.reduce((total, spend) => total + spend[field], 0);
  const priced = counted.flatMap((spend) => (spend.costUsd === null ? [] : [spend.costUsd]));
  return {
    tokens: sum("tokens"),
    inputTokens: sum("inputTokens"),
    cachedInputTokens: sum("cachedInputTokens"),
    outputTokens: sum("outputTokens"),
    costUsd: priced.length === 0 ? null : priced.reduce((total, cost) => total + cost, 0),
    short: counted.length < lives.length || counted.some((spend) => spend.short),
  };
}

export type Order = "lives" | "spent" | "newest" | "oldest";

const byName = (a: Avatar, b: Avatar) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0);

const costOf = (avatar: Avatar) => avatar.spend?.costUsd ?? 0;

/**
 * The collection's orders: the most lives, the most spent, the latest seen,
 * the first born; ties by name.
 */
export const ORDERS: Readonly<Record<Order, (a: Avatar, b: Avatar) => number>> = {
  lives: (a, b) => b.lives.length - a.lives.length || b.lastSeen - a.lastSeen || byName(a, b),
  spent: (a, b) =>
    costOf(b) - costOf(a) || (b.spend?.tokens ?? 0) - (a.spend?.tokens ?? 0) || byName(a, b),
  newest: (a, b) => b.lastSeen - a.lastSeen || byName(a, b),
  oldest: (a, b) => a.firstBorn - b.firstBorn || byName(a, b),
};

/** The name reborn most often, when one has lived more than once. */
export function spotlightOf(avatars: readonly Avatar[]): Avatar | undefined {
  const first = avatars.toSorted(ORDERS.lives)[0];
  return first !== undefined && first.lives.length > 1 ? first : undefined;
}

const counted = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** "12 names · 31 lives · 2 awake · $184 spent". */
export function tallyOf(avatars: readonly Avatar[], now: number): string {
  const lives = avatars.flatMap((avatar) => avatar.lives);
  const awake = lives.filter((life) => isAwake(life, now)).length;
  const spend = spendOf(lives);
  return [
    counted(avatars.length, "name", "names"),
    counted(lives.length, "life", "lives"),
    `${awake} awake`,
    ...(spend === null ? [] : [`${spentOf(spend)} spent`]),
  ].join(" · ");
}

/** "1.2M", "340k", "2.1B": a count of tokens, short. */
export function tokensOf(tokens: number): string {
  const short = (n: number, unit: string) =>
    `${n >= 100 ? Math.round(n) : Number(n.toFixed(1))}${unit}`;
  if (tokens >= 1e9) return short(tokens / 1e9, "B");
  if (tokens >= 1e6) return short(tokens / 1e6, "M");
  if (tokens >= 1e3) return short(tokens / 1e3, "k");
  return String(tokens);
}

/** "$184", "$4.20", "<$0.01", or the tokens when nothing had a price; "≥" when short. */
export function spentOf(spend: Spend): string {
  const cost = spend.costUsd;
  const amount =
    cost === null
      ? `${tokensOf(spend.tokens)} tokens`
      : cost >= 100
        ? `$${Math.round(cost).toLocaleString("en-US")}`
        : cost >= 0.01 || cost === 0
          ? `$${cost.toFixed(2)}`
          : "<$0.01";
  return spend.short && cost !== 0 ? `≥${amount}` : amount;
}
