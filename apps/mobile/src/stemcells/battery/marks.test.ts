import { describe, expect, it } from "vite-plus/test";

import { AWAY_AFTER_MS, batterySays, isAway, keptCharges, type MachineBattery } from "./marks";

const machine = (patch: Partial<MachineBattery> = {}): MachineBattery => ({
  environmentId: "a",
  label: "Laptop",
  percent: 9,
  power: "battery",
  sampledAt: 0,
  heardAt: 0,
  away: false,
  ...patch,
});

describe("what's kept of a machine's charge", () => {
  const battery = { percent: 64, power: "battery" as const };

  it("what it said stands while it says nothing, and a machine without one forgets it", () => {
    const kept = keptCharges();
    expect(kept("a", undefined, 0)).toBeNull();
    const heard = { ...battery, sampledAt: 5, heardAt: 100 };
    expect(kept("a", { sampledAt: 5, battery }, 100)).toEqual(heard);
    expect(kept("a", undefined, 200)).toEqual(heard);
    expect(kept("a", null, 200)).toEqual(heard);
    expect(kept("a", { sampledAt: 6 }, 200)).toBeNull();
    expect(kept("a", undefined, 200)).toBeNull();
  });

  it("is heard when an answer is new, by the phone's clock, not when it's read again", () => {
    const kept = keptCharges();
    kept("a", { sampledAt: 5, battery }, 100);
    expect(kept("a", { sampledAt: 5, battery }, 900)?.heardAt).toBe(100);
    expect(kept("a", { sampledAt: 6, battery }, 900)?.heardAt).toBe(900);
  });
});

describe("whether a machine is out of reach", () => {
  const minutes = (n: number) => n * 60_000;
  it.each([
    ["answering", true, true, minutes(1), false],
    ["just back at the front, its route coming back", false, false, minutes(9), false],
    ["just back at the front, its first answer on its way", true, false, minutes(9), false],
    ["a blip after a fresh reading", false, true, 1, false],
    ["gone", false, true, AWAY_AFTER_MS + 1, true],
    ["its socket still connected, long after it last answered", true, true, minutes(3), true],
  ])("%s", (_, connected, settled, now, away) => {
    expect(isAway(connected, settled, 0, now)).toBe(away);
  });
});

describe("what Aski says of a battery", () => {
  const flying = (ids: Record<string, number>) => (id: string) => ids[id] ?? 0;

  it("says a low machine's figure only with Cells flying on it", () => {
    expect(batterySays([machine()], flying({ a: 2 }))).toBe(
      "Laptop has 9% left. Two Cells flying.",
    );
    expect(batterySays([machine()], flying({ b: 2 }))).toBeNull();
  });

  it.each([
    ["above its low", machine({ percent: 11 })],
    ["low, charging", machine({ power: "charging" })],
    ["low, plugged in", machine({ power: "plugged" })],
  ])("says nothing %s", (_, battery) => {
    expect(batterySays([battery], flying({ a: 2 }))).toBeNull();
  });

  it("says one that went quiet at its low, never that it died", () => {
    expect(batterySays([machine({ percent: 3, away: true })], flying({ a: 1 }))).toBe(
      "Laptop went quiet at 3%.",
    );
  });

  it("says the machine still there before one gone, and the lowest first", () => {
    const gone = machine({ environmentId: "a", label: "Gone", percent: 2, away: true });
    const high = machine({ environmentId: "b", label: "High", percent: 10 });
    const low = machine({ environmentId: "c", label: "Low", percent: 4 });
    expect(batterySays([gone, high, low], flying({ a: 1, b: 1, c: 1 }))).toBe(
      "Low has 4% left. One Cell flying.",
    );
  });
});
