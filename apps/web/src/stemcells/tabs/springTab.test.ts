import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

import { SpringTab } from "./springTab";

const REST = 350;

function springTab() {
  const lit: Array<string | null> = [];
  const opened: string[] = [];
  const spring = new SpringTab({ onLit: (tabId) => lit.push(tabId), rest: () => REST });
  const open = (tabId: string) => opened.push(tabId);
  const over = (tabId: string, activeTabId: string) => spring.over(tabId, activeTabId, open);
  return { spring, over, lit, opened };
}

describe("spring-loaded tabs", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("a drag resting on a tab lights it, then opens it", () => {
    const { over, lit, opened } = springTab();
    over("b", "a");
    expect(lit).toEqual(["b"]);
    vi.advanceTimersByTime(REST - 1);
    expect(opened).toEqual([]);
    // dragover repeats while the hand rests; the rest doesn't start over.
    over("b", "a");
    vi.advanceTimersByTime(1);
    expect(opened).toEqual(["b"]);
    expect(lit).toEqual(["b", null]);
  });

  it("a drag passing over a tab never opens it", () => {
    const { spring, over, opened } = springTab();
    over("b", "a");
    vi.advanceTimersByTime(REST / 2);
    spring.out("b");
    vi.advanceTimersByTime(REST);
    expect(opened).toEqual([]);
  });

  it("moving to the next tab lights only that one and starts its rest afresh", () => {
    const { spring, over, lit, opened } = springTab();
    over("b", "a");
    vi.advanceTimersByTime(REST / 2);
    over("c", "a");
    // Leaving "b" arrives after entering "c": it must not put "c" out.
    spring.out("b");
    expect(lit).toEqual(["b", null, "c"]);
    vi.advanceTimersByTime(REST / 2);
    expect(opened).toEqual([]);
    vi.advanceTimersByTime(REST / 2);
    expect(opened).toEqual(["c"]);
  });

  it("the tab already open never lights", () => {
    const { over, lit, opened } = springTab();
    over("a", "a");
    vi.advanceTimersByTime(REST);
    expect(lit).toEqual([]);
    expect(opened).toEqual([]);
  });

  it("a drag let go or cancelled puts the light out", () => {
    const { spring, over, lit, opened } = springTab();
    over("b", "a");
    spring.out();
    vi.advanceTimersByTime(REST);
    expect(lit).toEqual(["b", null]);
    expect(opened).toEqual([]);
  });
});
