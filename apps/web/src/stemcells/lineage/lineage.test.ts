import { describe, expect, it } from "vite-plus/test";

import { avatarsOf, isAwake, type Life, ORDERS, spotlightOf, tallyOf, WARMTH_MS } from "./lineage";

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
});
