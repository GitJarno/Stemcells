import { describe, expect, it } from "vite-plus/test";

import { factAfter, STEM_CELL_FACTS } from "../../../../../stemcells/words/inbox.ts";
import {
  byWaiting,
  entered,
  left,
  LOOP_AT_REST,
  type Loop,
  opened,
  progressOf,
  read,
} from "./loop";

const reading = (queue: string[], open: string | null, now = 0, onInput = true) => ({
  queue,
  open,
  onInput,
  now,
});

describe("Input's queue", () => {
  it("lists the longest waiting first, one with no time last, a tie by key", () => {
    const cells = [
      { key: "b", since: "2026-11-27T10:00:00Z" },
      { key: "none", since: null },
      { key: "c", since: "2026-11-27T09:00:00Z" },
      { key: "a", since: "2026-11-27T10:00:00Z" },
    ];
    expect(
      byWaiting(
        cells,
        (cell) => cell.key,
        (cell) => cell.since,
      ).map((c) => c.key),
    ).toEqual(["c", "a", "b", "none"]);
  });
});

describe("the loop through Input", () => {
  it("opens the top where a chat stands beside the list, and nothing where the list fills the screen", () => {
    const beside = entered(LOOP_AT_REST, reading(["pip", "otter"], "harbor"), true);
    expect(beside.open).toBe("pip");
    expect(entered(LOOP_AT_REST, reading(["pip"], "harbor"), false).open).toBeNull();
    // Already open, it is followed as it stands.
    const open = entered(LOOP_AT_REST, reading(["pip"], "pip"), true);
    expect(open.open).toBeNull();
    expect(open.loop.following).toBe("pip");
  });

  it("opens the next in place once the open Cell's ask leaves, and only once", () => {
    let loop = entered(LOOP_AT_REST, reading(["pip", "otter", "bongo"], "pip"), true).loop;
    const answered = read(loop, reading(["otter", "bongo"], "pip"));
    expect(answered.open).toBe("otter");
    loop = answered.loop;
    // The answered chat still shows until the next lands: nothing opens again, the loop holds.
    const landing = read(loop, reading(["otter", "bongo"], "pip"));
    expect(landing.open).toBeNull();
    expect(landing.loop.following).toBe("otter");
    loop = read(landing.loop, reading(["otter", "bongo"], "otter")).loop;
    expect(read(loop, reading(["bongo"], "otter")).open).toBe("bongo");
  });

  it("stops once the person opens another chat", () => {
    const loop = entered(LOOP_AT_REST, reading(["pip", "otter"], "pip"), true).loop;
    const elsewhere = read(loop, reading(["pip", "otter"], "harbor"));
    expect(elsewhere.loop.following).toBeNull();
    expect(read(elsewhere.loop, reading(["otter"], "harbor")).open).toBeNull();
  });

  it("stays on a Cell that asks again, and takes a new ask in the queue by its age", () => {
    const loop = entered(LOOP_AT_REST, reading(["pip", "otter"], "pip"), true).loop;
    const again = read(loop, reading(["pip", "otter"], "pip"));
    expect(again.open).toBeNull();
    expect(again.loop.following).toBe("pip");
    // A new ask that waited longer stands first, and is the next to open.
    expect(read(again.loop, reading(["older", "otter"], "pip")).open).toBe("older");
  });

  it("follows a Cell opened from the list where nothing opened on its own", () => {
    const loop = entered(LOOP_AT_REST, reading(["pip", "otter"], null), false).loop;
    const tapped = opened(loop, "pip");
    expect(
      read(read(tapped, reading(["pip", "otter"], "pip")).loop, reading(["otter"], "pip")).open,
    ).toBe("otter");
  });

  it("ends the clearing once, with every Cell it met and how long it took, until the person turns away", () => {
    let loop: Loop = entered(LOOP_AT_REST, reading(["pip", "otter"], "pip", 1_000), true).loop;
    expect(progressOf(loop)).toEqual({ done: 0, of: 2 });
    loop = read(loop, reading(["otter"], "pip", 2_000)).loop;
    expect(progressOf(loop)).toEqual({ done: 1, of: 2 });
    const clear = read(loop, reading([], "otter", 61_000));
    expect(clear.allClear).toBe(true);
    expect(clear.loop.cleared).toEqual({ cells: new Set(["pip", "otter"]), ms: 60_000 });
    const after = read(clear.loop, reading([], "otter", 62_000));
    expect(after.allClear).toBe(false);
    expect(after.loop.cleared).toEqual(clear.loop.cleared);
    expect(left(after.loop).cleared).toBeNull();
    // A new ask takes the line's place too.
    expect(read(clear.loop, reading(["bongo"], "otter", 63_000)).loop.cleared).toBeNull();
  });

  it("starts no clearing away from Input, and none on an empty queue", () => {
    expect(read(LOOP_AT_REST, reading(["pip"], null, 0, false)).loop.clearing).toBeNull();
    expect(entered(LOOP_AT_REST, reading([], null), true).allClear).toBe(false);
  });
});

describe("the all-clear's fact", () => {
  it("goes through every fact before one comes again", () => {
    const seen = new Set<number>();
    let at: number | null = null;
    for (let index = 0; index < STEM_CELL_FACTS.length; index++) {
      at = factAfter(at, 0.5);
      seen.add(at);
    }
    expect(seen.size).toBe(STEM_CELL_FACTS.length);
    expect(factAfter(at, 0.5)).toBe(factAfter(null, 0.5));
  });
});
