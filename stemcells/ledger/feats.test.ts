import { describe, expect, it } from "vite-plus/test";

import type { Fact, Landed } from "./facts.ts";
import {
  FEATS,
  type FeatState,
  featsOf,
  type Local,
  todayOf,
  unlockedActs,
  unlockedPieces,
  wornIdOf,
} from "./feats.ts";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const START = Date.parse("2026-10-23T09:00:00.000Z");
const iso = (minutes: number) => new Date(START + minutes * MINUTE).toISOString();

/** The machine's calendar in the tests: UTC, whatever the clock of the Mac that runs them. */
const utc = (ms: number): Local => {
  const date = new Date(ms);
  return { day: date.toISOString().slice(0, 10), hour: date.getUTCHours() };
};

let runs = 0;
const landed = (minutes: number, data: Partial<Landed> = {}, threadId = "pip"): Fact => {
  const runId = `run-${runs++}`;
  return {
    key: `landed:${runId}`,
    kind: "landed",
    threadId,
    at: iso(minutes),
    data: { runId, ms: 2 * MINUTE, aloneMs: 2 * MINUTE, asks: 0, closeOut: "done", ...data },
  };
};
const born = (minutes: number, threadId: string, driver: string | null = "claudeAgent"): Fact => ({
  key: `born:${threadId}`,
  kind: "born",
  threadId,
  at: iso(minutes),
  data: { name: "Pip", driver, projectId: "website" },
});
const merged = (minutes: number, number: number, threadId = "pip"): Fact => ({
  key: `merged:${threadId}:example.com/team/website#${number}`,
  kind: "merged",
  threadId,
  at: iso(minutes),
  data: { number },
});
const settled = (minutes: number, threadId: string): Fact => ({
  key: `settled:${threadId}:${iso(minutes)}`,
  kind: "settled",
  threadId,
  at: iso(minutes),
  data: {},
});

const feats = (facts: ReadonlyArray<Fact>, now = START + DAY) =>
  new Map(featsOf(facts, {}, now, utc).map((state) => [state.id, state]));
const earned = (states: ReadonlyMap<string, FeatState>) =>
  [...states.values()].filter((state) => state.earned !== null).map((state) => state.id);

describe("the feats a crew earned, from the ledger's facts", () => {
  it("name each feat once, and each reward once", () => {
    expect(new Set(FEATS.map((feat) => feat.id)).size).toBe(FEATS.length);
    const rewards = FEATS.map((feat) => `${feat.reward.kind}:${feat.reward.id}`);
    expect(new Set(rewards).size).toBe(rewards.length);
  });

  it("earn nothing from no facts, and say how far each is", () => {
    const states = feats([]);
    expect(earned(states)).toEqual([]);
    expect(states.get("landings-100")).toEqual({
      id: "landings-100",
      have: 0,
      of: 100,
      earned: null,
    });
  });

  it("date a count's feat by the fact that reached it, and name its Cell", () => {
    const facts = Array.from({ length: 12 }, (_, n) =>
      landed(n * 3, {}, n === 9 ? "tenth" : "pip"),
    );
    // Read out of order: the ledger records a backfill in the order it reads chats.
    const states = feats(facts.toReversed());
    expect(states.get("landings-1")?.earned).toEqual({ at: iso(0), threadId: "pip" });
    expect(states.get("landings-10")?.earned).toEqual({ at: iso(27), threadId: "tenth" });
    expect(states.get("landings-50")).toMatchObject({ have: 12, of: 50, earned: null });
  });

  it.each<[string, Partial<Landed>, boolean]>([
    ["with Done and nothing asked", {}, true],
    ["a second short", { aloneMs: 10 * MINUTE - 1000 }, false],
    ["after an ask", { asks: 1 }, false],
    ["with something left", { closeOut: "left" }, false],
    ["with no close-out", { closeOut: null }, false],
  ])("count time alone for a run that landed %s", (_, data, counts) => {
    const states = feats([landed(0, { ms: 11 * MINUTE, aloneMs: 10 * MINUTE, ...data })]);
    expect(states.get("alone-10")?.earned !== null).toBe(counts);
  });

  it("count the runs in flight at one moment, a landing before a start at the same instant", () => {
    const flight = (from: number, to: number, threadId: string) =>
      landed(to, { ms: (to - from) * MINUTE }, threadId);
    // a: 0–10, b: 2–12, c: 10–20 follows a; d: 11–15 makes three with b and c.
    const three = feats([
      flight(0, 10, "a"),
      flight(2, 12, "b"),
      flight(10, 20, "c"),
      flight(11, 15, "d"),
    ]);
    expect(three.get("crew-3")?.earned).toEqual({ at: iso(11), threadId: "d" });
    expect(
      feats([flight(0, 10, "a"), flight(2, 12, "b"), flight(10, 20, "c")]).get("crew-3"),
    ).toMatchObject({ have: 2, earned: null });
  });

  it("count a day and a night on the machine's own calendar", () => {
    // 09:00 UTC is 23:00 the day before, ten hours west: these ten land across its midnight.
    const west = (ms: number): Local => utc(ms - 10 * HOUR);
    const facts = Array.from({ length: 10 }, (_, n) => landed(n * 12));
    const here = new Map(featsOf(facts, {}, START + DAY, utc).map((s) => [s.id, s]));
    const there = new Map(featsOf(facts, {}, START + DAY, west).map((s) => [s.id, s]));
    expect(here.get("day-10")?.earned).toEqual({ at: iso(108), threadId: "pip" });
    expect(here.get("night-1")?.earned).toBeNull();
    expect(there.get("day-10")).toMatchObject({ have: 5, earned: null });
    expect(there.get("night-1")?.earned).toEqual({ at: iso(60), threadId: "pip" });
  });

  it("break a run of quiet landings at an ask, and start it again", () => {
    const quiet = (minutes: number) => landed(minutes);
    const states = feats([
      quiet(0),
      quiet(1),
      quiet(2),
      quiet(3),
      landed(4, { asks: 2 }),
      quiet(5),
      quiet(6),
      quiet(7),
      quiet(8),
      landed(9, {}, "fifth"),
    ]);
    expect(states.get("quiet-5")?.earned).toEqual({ at: iso(9), threadId: "fifth" });
  });

  it("read the rest from the facts that show them", () => {
    const states = feats([
      born(0, "a", "claudeAgent"),
      born(1, "b", "codex"),
      born(2, "c", null),
      born(3, "d", "cursor"),
      landed(5, { ms: 40_000 }, "a"),
      merged(50, 12, "a"),
      merged(200, 13, "b"),
      settled(60, "a"),
      settled(61, "a"),
    ]);
    expect(states.get("drivers-3")?.earned).toEqual({ at: iso(3), threadId: "d" });
    expect(states.get("quick-1")?.earned).toEqual({ at: iso(5), threadId: "a" });
    expect(states.get("straight-1")?.earned).toEqual({ at: iso(50), threadId: "a" });
    expect(states.get("merges-1")?.earned).toEqual({ at: iso(50), threadId: "a" });
    // One Cell settled twice is one Cell settled.
    expect(states.get("settled-10")).toMatchObject({ have: 1 });
  });

  it("count one life's landings for the old hand", () => {
    const facts = [
      ...Array.from({ length: 24 }, (_, n) => landed(n, {}, "old")),
      ...Array.from({ length: 30 }, (_, n) => landed(100 + n, {}, `young-${n}`)),
    ];
    expect(feats(facts).get("life-25")).toMatchObject({ have: 24, earned: null });
    expect(feats([...facts, landed(500, {}, "old")]).get("life-25")?.earned).toEqual({
      at: iso(500),
      threadId: "old",
    });
  });

  it("count whole days since the first Cell, dated by the day that reached it", () => {
    const facts = [born(0, "a")];
    expect(feats(facts, START + 30 * DAY - 1).get("days-30")).toMatchObject({
      have: 29,
      earned: null,
    });
    expect(feats(facts, START + 400 * DAY).get("days-30")?.earned).toEqual({
      at: new Date(START + 30 * DAY).toISOString(),
      threadId: null,
    });
    expect(feats(facts, START + 400 * DAY).get("days-365")?.earned?.at).toBe(
      new Date(START + 365 * DAY).toISOString(),
    );
  });

  it("earn a secret feat from a deed told, and nothing else", () => {
    const states = new Map(
      featsOf([], { dazed: { at: iso(7), threadId: "pip" } }, START, utc).map((s) => [s.id, s]),
    );
    expect(earned(states)).toEqual(["dazed-1"]);
    expect(states.get("dazed-1")?.earned).toEqual({ at: iso(7), threadId: "pip" });
  });

  it("unlock what the earned feats name", () => {
    const states = [...feats(Array.from({ length: 10 }, (_, n) => landed(n))).values()];
    expect([...unlockedPieces(states)]).toContain("outfit:earned/rosette");
    expect([...unlockedPieces(states)]).not.toContain("outfit:earned/medal");
    expect([...unlockedActs(states)]).toContain("bow");
    expect(wornIdOf({ kind: "act", id: "bow" })).toBeUndefined();
  });
});

describe("the day so far", () => {
  it("counts what happened on the machine's day, and lists who landed, each once", () => {
    const now = START + 5 * HOUR;
    const today = todayOf(
      [
        landed(-12 * 60, {}, "yesterday"),
        born(1, "a"),
        landed(10, { aloneMs: 4 * MINUTE }, "a"),
        landed(20, { aloneMs: 9 * MINUTE }, "b"),
        landed(30, {}, "a"),
        merged(40, 3, "b"),
      ],
      now,
      utc,
    );
    expect(today).toEqual({
      day: "2026-10-23",
      landings: 3,
      merges: 1,
      cells: 1,
      aloneMs: 9 * MINUTE,
      landed: ["a", "b"],
    });
  });
});
