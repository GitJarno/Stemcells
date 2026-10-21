import { describe, expect, it } from "vite-plus/test";

import {
  createComposerScrollGestureState,
  recordComposerScrollGestureEvent,
  shouldCollapseComposerForScrollKey,
} from "./composerScrollGesture";

// The composer shrank to one line whenever the chat scrolled, so its height
// and its controls moved under the reader. It keeps one height now.
describe("the composer on a scroll", () => {
  it("never rests into one line on a long wheel up", () => {
    const state = createComposerScrollGestureState();
    const collapses = Array.from({ length: 20 }, (_, i) =>
      recordComposerScrollGestureEvent(state, {
        now: i * 10,
        deltaPx: 200,
        collapseThresholdPx: 50,
        collapseEligible: true,
        canScrollInGestureDirection: true,
        scrollsTowardLogicalEnd: false,
      }),
    );
    expect(collapses.some(Boolean)).toBe(false);
    expect(state.lastEventAt).toBe(190);
  });

  it("never rests into one line on a page or home key", () => {
    for (const key of ["PageUp", "Home", "PageDown", "End"]) {
      expect(
        shouldCollapseComposerForScrollKey({
          key,
          scrollTop: 500,
          scrollHeight: 4000,
          clientHeight: 800,
          isAtLogicalEnd: false,
        }),
      ).toBe(false);
    }
  });
});
