/**
 * Narrowing a pane left a chat read to its end mid-document: the reflow
 * grew it by more than a screen, past what upstream's list holds. The pane
 * now holds the end across a width change when the transcript was at it;
 * this pins what counts as at the end.
 */
import { describe, expect, it } from "vite-plus/test";

import { isAtEnd } from "./keepEnd";

describe("a transcript at its end", () => {
  it("shows its last pixel, within a pixel of rounding", () => {
    expect(isAtEnd({ scrollTop: 900, scrollHeight: 1700, clientHeight: 800 })).toBe(true);
    expect(isAtEnd({ scrollTop: 899.5, scrollHeight: 1700, clientHeight: 800 })).toBe(true);
  });

  it("is not at its end a screen short of it", () => {
    expect(isAtEnd({ scrollTop: 100, scrollHeight: 1700, clientHeight: 800 })).toBe(false);
  });
});
