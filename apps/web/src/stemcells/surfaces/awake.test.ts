import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import {
  browserAwake,
  raiseSlate,
  resetWakesForTests,
  subscribeToWakes,
  wakeBrowser,
} from "./awake";

afterEach(() => {
  resetWakesForTests();
});

// A launch brought back live, hidden browsers in Cells nobody was looking
// at, a draft's among them: every browser the server kept got a webview.
describe("a desktop browser on the slate", () => {
  it("sleeps until it is wanted", () => {
    raiseSlate();
    expect(browserAwake("tab", false)).toBe(false);
    expect(browserAwake("tab", true)).toBe(true);
  });

  it("stays awake for the run once it was wanted", () => {
    raiseSlate();
    wakeBrowser("tab");
    expect(browserAwake("tab", false)).toBe(true);
    expect(browserAwake("other", false)).toBe(false);
  });

  it("is upstream's, awake, until the slate first comes up", () => {
    expect(browserAwake("tab", false)).toBe(true);
  });

  it("tells React of each wake once", () => {
    const heard = vi.fn();
    const stop = subscribeToWakes(heard);
    raiseSlate();
    wakeBrowser("tab");
    wakeBrowser("tab");
    raiseSlate();
    stop();
    wakeBrowser("other");
    expect(heard).toHaveBeenCalledTimes(2);
  });
});
