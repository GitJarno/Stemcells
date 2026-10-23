import { describe, expect, it } from "vite-plus/test";

import {
  avatarsOf,
  isAwake,
  type Life,
  ORDERS,
  type Spend,
  spentOf,
  spotlightOf,
  tallyOf,
  tokensOf,
  WARMTH_MS,
} from "./lineage";

const HOUR = 3_600_000;

const life = (key: string, name: string, born: number, extra: Partial<Life> = {}): Life => ({
  key,
  threadId: key,
  name,
  driver: "claudeAgent",
  provider: "Claude",
  project: "Stemcells",
  title: key,
  born,
  lastSeen: born + HOUR,
  archived: false,
  running: false,
  ...extra,
});

describe("the lineage", () => {
  it("gathers the chats that drew one name into one avatar, its lives oldest first", () => {
    const avatars = avatarsOf([
      life("c", "Honker", 30 * HOUR),
      life("a", "Otter", 5 * HOUR),
      life("b", "Honker", 10 * HOUR, { lastSeen: 50 * HOUR }),
    ]);
    expect(avatars.map((avatar) => avatar.name)).toEqual(["Honker", "Otter"]);
    const honker = avatars[0]!;
    expect(honker.lives.map((l) => l.key)).toEqual(["b", "c"]);
    expect(honker.firstBorn).toBe(10 * HOUR);
    expect(honker.lastSeen).toBe(50 * HOUR);
  });

  it("orders by lives, by the latest seen, and by the first born", () => {
    const avatars = avatarsOf([
      life("a", "Ada", 1 * HOUR),
      life("b", "Bee", 2 * HOUR),
      life("c", "Bee", 3 * HOUR),
      life("d", "Cy", 9 * HOUR),
    ]);
    expect(avatars.toSorted(ORDERS.lives).map((a) => a.name)).toEqual(["Bee", "Cy", "Ada"]);
    expect(avatars.toSorted(ORDERS.newest).map((a) => a.name)).toEqual(["Cy", "Bee", "Ada"]);
    expect(avatars.toSorted(ORDERS.oldest).map((a) => a.name)).toEqual(["Ada", "Bee", "Cy"]);
  });

  it("spotlights a name only once it has come back", () => {
    expect(spotlightOf(avatarsOf([life("a", "Ada", 0), life("b", "Bee", HOUR)]))).toBeUndefined();
    expect(spotlightOf(avatarsOf([life("a", "Ada", 0), life("b", "Ada", HOUR)]))?.name).toBe("Ada");
  });

  it("counts a life awake while it works or lately changed, never once archived", () => {
    const now = 100 * HOUR;
    const recent = life("a", "Ada", 0, { lastSeen: now - WARMTH_MS / 2 });
    expect(isAwake(recent, now)).toBe(true);
    expect(isAwake({ ...recent, archived: true }, now)).toBe(false);
    expect(isAwake(life("b", "Ada", 0, { running: true }), now)).toBe(true);
    expect(isAwake(life("c", "Ada", 0), now)).toBe(false);
    expect(tallyOf(avatarsOf([recent, life("c", "Bee", 0)]), now)).toBe(
      "2 names · 2 lives · 1 awake",
    );
  });

  it("adds a name's lives' spend up, short when a life went uncounted", () => {
    const spent = (costUsd: number | null, tokens: number, short = false): Spend => ({
      tokens,
      inputTokens: tokens,
      cachedInputTokens: 0,
      outputTokens: 0,
      costUsd,
      short,
    });
    const avatars = avatarsOf([
      life("a", "Honker", 1 * HOUR, { spend: spent(1.5, 1_000) }),
      life("b", "Honker", 2 * HOUR, { spend: spent(null, 500) }),
      life("c", "Otter", 3 * HOUR, { spend: spent(4, 2_000) }),
      life("d", "Otter", 4 * HOUR),
      life("e", "Ada", 5 * HOUR),
    ]);
    const byName = new Map(avatars.map((avatar) => [avatar.name, avatar.spend]));
    expect(byName.get("Honker")).toMatchObject({ tokens: 1_500, costUsd: 1.5, short: false });
    expect(byName.get("Otter")).toMatchObject({ tokens: 2_000, costUsd: 4, short: true });
    expect(byName.get("Ada")).toBeNull();
    expect(avatars.toSorted(ORDERS.spent).map((avatar) => avatar.name)).toEqual([
      "Otter",
      "Honker",
      "Ada",
    ]);
    expect(tallyOf(avatars, 100 * HOUR)).toBe("3 names · 5 lives · 0 awake · ≥$5.50 spent");
  });

  it("says spend short: dollars, tokens when nothing had a price, ≥ when the count is short", () => {
    const spend = (costUsd: number | null, short = false): Spend => ({
      tokens: 2_140_000,
      inputTokens: 0,
      cachedInputTokens: 0,
      outputTokens: 0,
      costUsd,
      short,
    });
    expect(spentOf(spend(1234.4))).toBe("$1,234");
    expect(spentOf(spend(4.2))).toBe("$4.20");
    expect(spentOf(spend(0.004))).toBe("<$0.01");
    expect(spentOf(spend(null))).toBe("2.1M tokens");
    expect(spentOf(spend(4.2, true))).toBe("≥$4.20");
    expect([tokensOf(999), tokensOf(340_000), tokensOf(2_133_357_987)]).toEqual([
      "999",
      "340k",
      "2.1B",
    ]);
  });
});
