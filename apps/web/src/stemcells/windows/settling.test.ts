import { describe, expect, it } from "vite-plus/test";

import { heardSettles } from "./settling";

const NOW = Date.parse("2026-10-30T09:00:00.000Z");
const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;

/** Local storage as the app keeps it between starts. */
function storage() {
  const items = new Map<string, string>();
  return {
    get length() {
      return items.size;
    },
    key: (index: number) => [...items.keys()][index] ?? null,
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value),
    removeItem: (key: string) => void items.delete(key),
  };
}

const settle = (threadId: string, at: number) => ({ threadId, at: new Date(at).toISOString() });
const cell = (environmentId: string, threadId: string) => ({
  environmentId,
  threadId,
  draftId: null,
});

describe("the settles a window acts on", () => {
  it("closes nothing settled before its first start", () => {
    const kept = storage();
    const heard = heardSettles(kept, "window", NOW);
    expect(heard("mac", [settle("otter", NOW - MINUTE)])).toEqual([]);
  });

  it("closes a Cell settled while it was away at its next start, once", () => {
    const kept = storage();
    expect(heardSettles(kept, "window", NOW)("mac", [])).toEqual([]);
    // Closed, or asleep: the phone settles Otter meanwhile.
    const back = heardSettles(kept, "window", NOW + 2 * 60 * MINUTE);
    const settles = [settle("pip", NOW - MINUTE), settle("otter", NOW + 60 * MINUTE)];
    expect(back("mac", settles)).toEqual([cell("mac", "otter")]);
    expect(back("mac", settles)).toEqual([]);
    // Opened again after its settle, it stays at every start after.
    expect(heardSettles(kept, "window", NOW + 3 * 60 * MINUTE)("mac", settles)).toEqual([]);
  });

  it("closes a Cell settled on another machine, once, by that machine's own mark", () => {
    const kept = storage();
    const heard = heardSettles(kept, "window", NOW);
    expect(heard("mac", [])).toEqual([]);
    expect(heard("mini", [])).toEqual([]);
    const later = [settle("otter", NOW + MINUTE)];
    expect(heard("mini", later)).toEqual([cell("mini", "otter")]);
    expect(heard("mini", later)).toEqual([]);
    expect(heard("mac", [settle("pip", NOW - MINUTE)])).toEqual([]);
  });

  it("keeps each window's own marks, and forgets a window long gone", () => {
    const kept = storage();
    heardSettles(kept, "gone", NOW - 31 * DAY)("mac", []);
    heardSettles(kept, "other", NOW - DAY)("mac", []);
    const heard = heardSettles(kept, "window", NOW);
    heard("mac", []);
    expect([...Array(kept.length).keys()].map((index) => kept.key(index))).toEqual([
      "stemcells.settles.heardThrough.other",
      "stemcells.settles.heardThrough.window",
    ]);
    // The other window was away since a day ago: its own start closes what settled meanwhile.
    const other = heardSettles(kept, "other", NOW + MINUTE);
    expect(other("mac", [settle("otter", NOW)])).toEqual([cell("mac", "otter")]);
  });
});
