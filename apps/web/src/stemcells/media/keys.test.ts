import { describe, expect, it } from "vite-plus/test";

import { viewerKey, type KeyPress } from "./keys";

const press = (key: string, more: Partial<KeyPress> = {}): KeyPress => ({
  key,
  metaKey: false,
  ctrlKey: false,
  altKey: false,
  ...more,
});

describe("the viewer's keys", () => {
  it("steps with the arrows, on a picture and on a video (never seeking it)", () => {
    for (const showing of ["image", "video"] as const) {
      expect(viewerKey(press("ArrowLeft"), showing)).toBe("previous");
      expect(viewerKey(press("ArrowRight"), showing)).toBe("next");
    }
  });

  it("closes on Escape and ⌘W", () => {
    expect(viewerKey(press("Escape"), "video")).toBe("close");
    expect(viewerKey(press("w", { metaKey: true }), "image")).toBe("close");
  });

  it("plays a video on Space, and puts a picture away (Quick Look)", () => {
    expect(viewerKey(press(" "), "video")).toBe("play");
    expect(viewerKey(press(" "), "image")).toBe("close");
  });

  it("zooms a picture from the keyboard, and leaves Enter to a focused control", () => {
    expect(viewerKey(press("+"), "image")).toBe("zoom-in");
    expect(viewerKey(press("-"), "image")).toBe("zoom-out");
    expect(viewerKey(press("0"), "image")).toBe("zoom-fit");
    expect(viewerKey(press("Enter"), "image")).toBe("zoom-toggle");
    expect(viewerKey(press("Enter", { onControl: true }), "image")).toBe("pass");
  });

  it("keeps typing from reaching the chat behind, and lets focus move", () => {
    expect(viewerKey(press("a"), "image")).toBe("hold");
    expect(viewerKey(press("ArrowUp"), "video")).toBe("hold");
    expect(viewerKey(press("Tab"), "image")).toBe("pass");
  });

  it("keeps the app's chords from acting behind it (⌘T opened a tab), leaving the system's", () => {
    for (const key of ["t", "d", "c", "q"]) {
      expect(viewerKey(press(key, { metaKey: true }), "image")).toBe("system");
    }
    expect(viewerKey(press("d", { metaKey: true }), "video")).toBe("system");
  });
});
