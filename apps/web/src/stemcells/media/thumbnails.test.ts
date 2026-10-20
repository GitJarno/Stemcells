/**
 * Which thumbnail a picture flies home to: one a person sees, in the
 * timeline, or none. Elements here are stand-ins that answer the few
 * questions the lookup asks (where it is, what it shows, which row holds it).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

import { TIMELINE_ROW, type MediaItem } from "../upstream/media";
import type { Rect } from "./geometry";
import { thumbnailOf } from "./thumbnails";

const ROW = { row: true };

function thumbnail(src: string, rect: Rect, inRow: boolean): HTMLImageElement {
  return {
    isConnected: true,
    currentSrc: src,
    parentElement: null,
    getAttribute: (name: string) => (name === "src" ? src : null),
    getClientRects: () => [rect],
    getBoundingClientRect: () => ({
      left: rect.x,
      top: rect.y,
      width: rect.width,
      height: rect.height,
    }),
    closest: (selector: string) => (selector === TIMELINE_ROW && inRow ? ROW : null),
  } as unknown as HTMLImageElement;
}

const chat = (...elements: HTMLImageElement[]) =>
  ({ querySelectorAll: () => elements }) as unknown as ParentNode;

const shot: MediaItem = { src: "https://local/shot.png", name: "shot.png" };
const inTimeline = { within: TIMELINE_ROW };

beforeEach(() => {
  vi.stubGlobal("window", { innerWidth: 1200, innerHeight: 800 });
  vi.stubGlobal("document", { body: null });
  vi.stubGlobal("getComputedStyle", () => ({
    visibility: "visible",
    overflowX: "visible",
    overflowY: "visible",
  }));
});

afterEach(() => vi.unstubAllGlobals());

describe("the thumbnail a picture flies home to", () => {
  it("is in the chat's timeline, never the composer's copy of it (it flew into the composer)", () => {
    const composer = thumbnail(shot.src!, { x: 40, y: 700, width: 80, height: 60 }, false);
    const row = thumbnail(shot.src!, { x: 40, y: 300, width: 200, height: 120 }, true);
    expect(thumbnailOf({ root: chat(composer, row), ...inTimeline }, shot, shot.src)).toBe(row);
  });

  it("is the first a person sees, passing over one scrolled away", () => {
    const above = thumbnail(shot.src!, { x: 40, y: -400, width: 200, height: 120 }, true);
    const seen = thumbnail(shot.src!, { x: 40, y: 300, width: 200, height: 120 }, true);
    const later = thumbnail(shot.src!, { x: 40, y: 500, width: 200, height: 120 }, true);
    expect(thumbnailOf({ root: chat(above, seen, later), ...inTimeline }, shot, shot.src)).toBe(
      seen,
    );
  });

  it("is none when every copy is out of view (it flew, and gave focus, to one off screen)", () => {
    const mostlyAbove = thumbnail(shot.src!, { x: 40, y: -100, width: 200, height: 120 }, true);
    const below = thumbnail(shot.src!, { x: 40, y: 900, width: 200, height: 120 }, true);
    expect(thumbnailOf({ root: chat(mostlyAbove, below), ...inTimeline }, shot, shot.src)).toBe(
      null,
    );
  });
});
