import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

/** The module fresh, with a window whose input listeners the test can fire. */
async function setup() {
  vi.resetModules();
  const listeners = new Map<string, () => void>();
  vi.stubGlobal("window", {
    addEventListener: (type: string, listener: () => void) => listeners.set(type, listener),
  });
  const { whenStill } = await import("./still");
  return { whenStill, input: (type: string) => listeners.get(type)?.() };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.advanceTimersByTime(10_000);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("work that waits for still hands", () => {
  it("runs at once when nothing was pressed lately", async () => {
    const { whenStill } = await setup();
    const task = vi.fn();
    whenStill(task);
    vi.advanceTimersByTime(1);
    expect(task).toHaveBeenCalledTimes(1);
  });

  it("waits a beat after the last key, press or scroll, and starts the beat again at each", async () => {
    const { whenStill, input } = await setup();
    const task = vi.fn();
    whenStill(task);
    input("keydown");
    vi.advanceTimersByTime(400);
    input("wheel");
    vi.advanceTimersByTime(400);
    expect(task).not.toHaveBeenCalled();
    vi.advanceTimersByTime(300);
    expect(task).toHaveBeenCalledTimes(1);
  });

  it("never runs once cancelled", async () => {
    const { whenStill, input } = await setup();
    const task = vi.fn();
    const cancel = whenStill(task);
    input("pointerdown");
    cancel();
    vi.advanceTimersByTime(5_000);
    expect(task).not.toHaveBeenCalled();
  });
});
