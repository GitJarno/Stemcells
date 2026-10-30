import { describe, expect, it } from "vite-plus/test";

import type { CommandOutcome } from "../upstream/needs";
import { needFixture } from "./fixtures";
import type { Hold } from "./holds";
import { createPulling, laterOf } from "./later";
import type { NeedsState } from "./stream";
import type { LaterNeed } from "./wire";

const put = (key: string, until: string): LaterNeed => ({
  ...needFixture({ key, threadId: `thread-${key}` }),
  until,
});

const laterHold = (key: string, state: Hold["state"]): Hold => ({
  key,
  id: 1,
  threadId: `thread-${key}`,
  commands: [{ type: "snooze", until: "2026-10-21T13:00:00.000Z" }],
  state,
  why: null,
  words: null,
  wordsBack: false,
});

describe("what the person put off", () => {
  it("is the server's, soonest back first, and a Later just given before the server says so", () => {
    const state: NeedsState = {
      needs: [needFixture({ key: "pip" }), needFixture({ key: "bongo" })],
      later: [put("otter", "2026-10-21T13:30:00.000Z"), put("floof", "2026-10-21T12:15:00.000Z")],
      cells: [],
      live: true,
    };
    const holds = new Map([
      ["pip", laterHold("pip", "holding")],
      ["bongo", laterHold("bongo", "failed")],
    ]);
    expect(laterOf(state, holds, new Map()).map((need) => need.key)).toEqual([
      "floof",
      "pip",
      "otter",
    ]);
    // Pulled back, it is an ask again before the server's list says so.
    const otter = state.later![0]!;
    expect(laterOf(state, holds, new Map([["otter", otter]])).map((need) => need.key)).toEqual([
      "floof",
      "pip",
    ]);
  });
});

function setup() {
  const otter = put("otter", "2026-10-21T13:30:00.000Z");
  let state: NeedsState = { needs: [], later: [otter], cells: [], live: true };
  const listeners = new Set<() => void>();
  let answer: (outcome: CommandOutcome) => void = () => {};
  const pulling = createPulling({
    needs: () => state,
    subscribeNeeds: (listener) => {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
    unsnooze: () => new Promise((resolve) => (answer = resolve)),
  });
  return {
    pull: () => pulling.pull(otter),
    answer: (outcome: CommandOutcome) => answer(outcome),
    pulled: () => [...pulling.read().keys()],
    following: () => listeners.size,
    setNeeds(next: NeedsState) {
      state = next;
      for (const listener of listeners) listener();
    },
    otter,
  };
}

describe("an ask pulled back from Later", () => {
  it("is an ask at once, until the server's list has it back", async () => {
    const t = setup();
    const pulling = t.pull();
    expect(t.pulled()).toEqual(["otter"]);
    t.answer({ ok: true });
    await pulling;
    expect(t.pulled()).toEqual(["otter"]);
    t.setNeeds({ needs: [t.otter], later: [], cells: [], live: true });
    expect(t.pulled()).toEqual([]);
    expect(t.following()).toBe(0);
  });

  it("waits with the others again when upstream refuses the unsnooze", async () => {
    const t = setup();
    const pulling = t.pull();
    t.answer({ ok: false, why: "This connection can't change Cells." });
    expect(await pulling).toBe(false);
    expect(t.pulled()).toEqual([]);
  });
});
