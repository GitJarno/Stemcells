import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

import { needFixture } from "./fixtures";
import { createPage } from "./page";
import type { NeedsState } from "./stream";

const LINGER = 1_200;
const CLEARED_FOR = 5_000;
const TYPING_PAUSE = 1_000;
const floof = needFixture({ key: "floof", number: 1 });

function setup() {
  let state: NeedsState = { needs: [], live: true };
  let notify = () => {};
  const page = createPage({
    needs: () => state,
    subscribeNeeds: (listener) => ((notify = listener), () => {}),
    now: () => Date.now(),
    linger: () => LINGER,
    clearedFor: () => CLEARED_FOR,
    typingPause: () => TYPING_PAUSE,
  });
  page.subscribe(() => {});
  return {
    page,
    push: (needs: NeedsState["needs"]) => {
      state = { needs, live: true };
      notify();
    },
  };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("Aski's page around the list", () => {
  it("keeps the column out while the person types, and lets it in once they pause", () => {
    const t = setup();
    t.page.setDraft("for 1 go with");
    t.push([floof]);
    expect(t.page.read().columnIn).toBe(false);
    vi.advanceTimersByTime(TYPING_PAUSE);
    expect(t.page.read().columnIn).toBe(true);
  });

  it("brings the column in at once when the composer is empty", () => {
    const t = setup();
    t.push([floof]);
    expect(t.page.read().columnIn).toBe(true);
  });

  it("holds a gone card while frozen and lets it leave a beat after unfreezing", () => {
    const t = setup();
    t.push([floof]);
    t.page.setFrozen(true);
    t.push([]);
    vi.advanceTimersByTime(10 * LINGER);
    expect(t.page.read().shown.map((each) => each.goneAt !== null)).toEqual([true]);
    t.page.setFrozen(false);
    expect(t.page.read().shown).toEqual([]);
    expect(t.page.read().cleared).toMatch(/^All clear · 1 answered in /);
  });

  it("shows the all-clear line for a moment, then lets the column go", () => {
    const t = setup();
    t.push([floof]);
    t.push([]);
    vi.advanceTimersByTime(LINGER);
    expect(t.page.read().cleared).not.toBeNull();
    expect(t.page.read().columnIn).toBe(true);
    vi.advanceTimersByTime(CLEARED_FOR);
    expect(t.page.read()).toMatchObject({ cleared: null, columnIn: false });
  });

  it("keeps an open sheet through the all-clear line, then closes it so the next card can't open it", () => {
    const t = setup();
    t.push([floof]);
    t.page.setSheet(true);
    t.push([]);
    vi.advanceTimersByTime(LINGER);
    expect(t.page.read()).toMatchObject({ shown: [], sheet: true });
    expect(t.page.read().cleared).not.toBeNull();
    vi.advanceTimersByTime(CLEARED_FOR);
    expect(t.page.read().sheet).toBe(false);
    t.push([needFixture({ key: "otter", number: 1 })]);
    expect(t.page.read().sheet).toBe(false);
  });
});
