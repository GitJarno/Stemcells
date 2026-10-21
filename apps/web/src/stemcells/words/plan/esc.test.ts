import { describe, expect, it } from "vite-plus/test";

import { escDropsPlan } from "./esc";

const esc = { key: "Escape", isComposing: false };
const inComposer = { inComposer: true, menuOpen: false };

// Esc gave no way out of a plan Aski was thinking or holding (#173's review).
describe("Esc on Aski's plan", () => {
  it("drops it from the composer", () => {
    expect(escDropsPlan(esc, inComposer)).toBe(true);
  });

  it("closes a word's menu first, and leaves the plan", () => {
    expect(escDropsPlan(esc, { inComposer: true, menuOpen: true })).toBe(false);
  });

  it("is someone else's outside the composer, or while an input method composes", () => {
    expect(escDropsPlan(esc, { inComposer: false, menuOpen: false })).toBe(false);
    expect(escDropsPlan({ key: "Escape", isComposing: true }, inComposer)).toBe(false);
    expect(escDropsPlan({ key: "Enter", isComposing: false }, inComposer)).toBe(false);
  });
});
