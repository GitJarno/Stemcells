import { describe, expect, it } from "vite-plus/test";

import { needFixture } from "./fixtures";
import { createLeaving } from "./leaving";
import type { NeedsState } from "./stream";

const THREAD = needFixture().threadId;

function setup() {
  let state: NeedsState = { needs: [needFixture()], cells: null, live: true };
  const listeners = new Set<() => void>();
  const leaving = createLeaving({
    needs: () => state,
    subscribeNeeds: (listener) => {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
  });
  const settle = () => {
    let done: (settled: boolean) => void = () => {};
    const settling = leaving.leaveWhile(
      THREAD,
      new Promise<boolean>((resolve) => (done = resolve)),
    );
    return { settling, done };
  };
  return {
    leaving,
    settle,
    following: () => listeners.size,
    setNeeds(next: NeedsState) {
      state = next;
      for (const listener of listeners) listener();
    },
    gone: () => leaving.read().has(THREAD),
  };
}

describe("a Cell the person settles", () => {
  it("is off the list at once, while its settle runs", () => {
    const t = setup();
    t.settle();
    expect(t.gone()).toBe(true);
  });

  it("comes back when its settle fails", async () => {
    const t = setup();
    const { settling, done } = t.settle();
    done(false);
    await settling;
    expect(t.gone()).toBe(false);
  });

  it("stays off until the server's list lets it go, then shows again if it comes back", async () => {
    const t = setup();
    const { settling, done } = t.settle();
    done(true);
    await settling;
    expect(t.gone()).toBe(true);
    t.setNeeds({ needs: [], cells: [], live: true });
    expect(t.gone()).toBe(false);
    expect(t.following()).toBe(0);
  });
});
