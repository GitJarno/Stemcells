/**
 * The viewer's hands, on a stage that records what it is asked to do: once
 * the picture is on its way home nothing cuts that short, a picture whose
 * URL changes stays as it is, and while the viewer is up it hears every key
 * before the app's shortcuts do.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

import { workspaceKeyListeners } from "../tabs/useWorkspaceKeys";
import type { MediaItem } from "../upstream/media";
import type { Rect, Size } from "./geometry";
import { itemKey } from "./reel";
import { Viewer, type ViewerState } from "./viewer";

const stage = vi.hoisted(() => {
  const record = { moves: [] as string[], landed: null as (() => void) | null };
  class FakeStage {
    rest: Rect | null = null;
    pose = { x: 0, y: 0, scale: 1 };
    get zoomed() {
      return this.pose.scale > 1.01;
    }
    place(rest: Rect) {
      record.moves.push("place");
      this.rest = rest;
    }
    land(_to: unknown, done: () => void) {
      record.moves.push("land");
      record.landed = done;
    }
    pinch(scale: number) {
      record.moves.push("pinch");
      this.pose = { ...this.pose, scale };
    }
    blank = () => record.moves.push("blank");
    lift = () => record.moves.push("lift");
    stepOut = () => record.moves.push("stepOut");
    stepIn = () => record.moves.push("stepIn");
    lean = () => record.moves.push("lean");
    zoomTo = () => record.moves.push("zoomTo");
    panBy = () => record.moves.push("panBy");
    settlePan = () => record.moves.push("settlePan");
    swipeTo = () => record.moves.push("swipeTo");
    swipeBack = () => record.moves.push("swipeBack");
    settlePinch = () => record.moves.push("settlePinch");
    showCaption = () => {};
    hideCaption = () => {};
  }
  return { record, FakeStage };
});
vi.mock("./stage", () => ({ Stage: stage.FakeStage }));

const SIZE: Size = { width: 1600, height: 1000 };

const picture = (src: string): MediaItem => ({ src, name: src.split("/").at(-1)! });

const stored = (path: string, src: string | null): MediaItem =>
  ({
    src,
    name: path,
    actionsSource: {
      kind: "image",
      name: path,
      src,
      asset: {
        environmentId: "env",
        resource: { _tag: "media-file", threadId: "thread", path },
      },
    },
  }) as MediaItem;

const state = (items: readonly MediaItem[], index = 0): ViewerState => ({
  items,
  index,
  src: items[index]?.src ?? null,
  scope: { root: null, within: null },
});

const part = () =>
  Object.assign(new EventTarget(), {
    contains: () => false,
    querySelector: () => null,
    dataset: {},
    setPointerCapture: () => {},
  }) as unknown as HTMLElement;

const opened: Viewer[] = [];

function open(items: readonly MediaItem[], size: Size | null) {
  const viewer = new Viewer({ source: null, opener: null });
  const steps: MediaItem[] = [];
  const closed = vi.fn();
  viewer.listen({ onStep: (item) => steps.push(item), onClosed: closed });
  const parts = { popup: part(), figure: part(), scrim: part(), caption: part() };
  viewer.attach(parts);
  opened.push(viewer);
  if (size) viewer.measured(itemKey(items[0]!), size);
  viewer.sync(state(items));
  return { viewer, parts, steps, closed };
}

const key = (name: string, more: Partial<KeyboardEvent> = {}) =>
  Object.assign(new Event("keydown", { cancelable: true }), {
    key: name,
    metaKey: false,
    ctrlKey: false,
    altKey: false,
    repeat: false,
    ...more,
  }) as KeyboardEvent;

/**
 * A wheel event, sent at `at` ms on the viewer's clock. Fake timers start
 * `performance.now()` at 0 and move it only as a test advances them, so `at`
 * is what the clock reads when the test sends it.
 */
const wheel = (at: number, deltaX: number, deltaY: number, ctrlKey = false) => {
  const event = Object.assign(new Event("wheel", { cancelable: true }), {
    deltaX,
    deltaY,
    deltaMode: 0,
    ctrlKey,
    clientX: 600,
    clientY: 400,
  });
  Object.defineProperty(event, "timeStamp", { value: at });
  return event;
};

/** What the stage was asked to do from its landing on. */
const sinceLanding = () => stage.record.moves.slice(stage.record.moves.indexOf("land"));

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "performance"] });
  stage.record.moves = [];
  stage.record.landed = null;
  vi.stubGlobal(
    "window",
    Object.assign(new EventTarget(), {
      innerWidth: 1200,
      innerHeight: 800,
      setTimeout: (run: () => void, ms: number) => setTimeout(run, ms),
    }),
  );
  vi.stubGlobal("document", { activeElement: null, querySelector: () => null });
  vi.stubGlobal("navigator", { platform: "MacIntel" });
  // Nothing in these tests is an element of these kinds.
  for (const kind of ["HTMLElement", "HTMLButtonElement", "HTMLImageElement", "HTMLVideoElement"]) {
    vi.stubGlobal(kind, function Absent() {});
  }
  vi.stubGlobal("WheelEvent", { DOM_DELTA_PIXEL: 0 });
});

afterEach(() => {
  opened.splice(0).forEach((viewer) => viewer.detach());
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("a picture on its way home", () => {
  it("isn't placed again by a size learned as it lands (a late load cut the close short)", () => {
    const item = picture("https://local/a.png");
    const { viewer, closed } = open([item], null);
    viewer.close();
    viewer.measured(itemKey(item), SIZE);
    window.dispatchEvent(new Event("resize"));
    viewer.sync(state([item]));
    expect(stage.record.moves).toEqual(["blank", "land"]);
    stage.record.landed!();
    expect(closed).toHaveBeenCalledOnce();
  });

  it("isn't turned back by a swipe let go after the close (its idle timer cut the landing short)", () => {
    const { viewer, parts } = open([picture("blob:a"), picture("blob:b")], SIZE);
    parts.popup.dispatchEvent(wheel(0, -20, 0));
    vi.advanceTimersByTime(16);
    parts.popup.dispatchEvent(wheel(16, -20, 0));
    viewer.close();
    vi.advanceTimersByTime(500);
    expect(sinceLanding()).toEqual(["land"]);
  });

  it("isn't settled by a pinch let go after the close", () => {
    const { viewer, parts } = open([picture("blob:a")], SIZE);
    parts.popup.dispatchEvent(wheel(0, 0, -20, true));
    viewer.close();
    vi.advanceTimersByTime(500);
    expect(sinceLanding()).toEqual(["land"]);
  });

  it("with no thumbnail in view, gives focus back where it was, never to what isn't drawn", () => {
    vi.stubGlobal("getComputedStyle", () => ({ visibility: "visible" }));
    const opener = (rects: number) =>
      ({
        isConnected: true,
        getClientRects: () => Array.from({ length: rects }),
      }) as unknown as HTMLElement;
    const shown = opener(1);
    const hidden = opener(0);
    for (const [from, to] of [
      [shown, shown],
      [hidden, null],
    ] as const) {
      const viewer = new Viewer({ source: null, opener: from });
      viewer.close();
      expect(viewer.focusAfterClose()).toBe(to);
    }
  });
});

describe("a video whose URL fails part way", () => {
  it("picks up where it was on its next URL (a seek past a signed URL's time started it over)", () => {
    class Video {
      currentTime = 0;
      paused = true;
      videoWidth = 640;
      videoHeight = 360;
      play = vi.fn(() => Promise.resolve());
      pause = vi.fn();
    }
    vi.stubGlobal("HTMLVideoElement", Video);
    const clip: MediaItem = {
      src: "https://local/clip.webm?v=1",
      name: "clip.webm",
      type: "video",
    };
    const { parts } = open([clip], SIZE);
    const heard = (type: string, video: Video) => {
      const event = new Event(type);
      Object.defineProperty(event, "target", { value: video });
      parts.figure.dispatchEvent(event);
    };
    heard("error", Object.assign(new Video(), { currentTime: 95, paused: false }));
    const next = new Video();
    heard("loadedmetadata", next);
    expect(next.currentTime).toBe(95);
    expect(next.play).toHaveBeenCalledOnce();
    // Once: a later load of it is left where it is.
    const later = new Video();
    heard("loadedmetadata", later);
    expect(later.currentTime).toBe(0);
  });
});

describe("the picture showing", () => {
  it("stays as it is when its URL is re-signed (the entrance played again)", () => {
    const { viewer } = open([stored("out/chart.png", "https://local/chart?v=1")], SIZE);
    viewer.sync(state([stored("out/chart.png", "https://local/chart?v=2")]));
    expect(stage.record.moves).toEqual(["place", "lift"]);
  });

  it("stays as it is when the reel learns its stored name, and keeps its size", () => {
    const { viewer } = open([picture("https://local/a2")], SIZE);
    viewer.sync(state([stored("uploads/a2.png", "https://local/a2")]));
    expect(stage.record.moves).toEqual(["place", "lift"]);
    window.dispatchEvent(new Event("resize"));
    expect(stage.record.moves).toEqual(["place", "lift", "place"]);
  });
});

describe("keys while the viewer is up", () => {
  const handlers = () => ({
    newCell: vi.fn(() => true),
    closeTab: vi.fn(() => true),
    splitRight: vi.fn(() => true),
    splitDown: vi.fn(() => true),
    closePane: vi.fn(() => true),
  });

  it("reach the viewer before the app's shortcuts, which stand down (⌘T opened a tab behind it)", () => {
    const workspace = handlers();
    const listeners = workspaceKeyListeners(() => workspace);
    // In the order the app registers them: the workspace's, a chat's, then the viewer's own.
    window.addEventListener("keydown", listeners.onKeyDownCapture, true);
    window.addEventListener("keydown", listeners.onKeyDown);
    const chat = vi.fn();
    window.addEventListener("keydown", chat, true);
    const b = picture("blob:b");
    const { steps } = open([picture("blob:a"), b], SIZE);

    const tab = key("t", { metaKey: true });
    for (const chord of [
      tab,
      key("d", { metaKey: true }),
      key("d", { metaKey: true, shiftKey: true }),
    ]) {
      window.dispatchEvent(chord);
    }
    expect(Object.values(workspace).every((run) => run.mock.calls.length === 0)).toBe(true);
    // The system's own chords (copy, quit) keep their default.
    expect(tab.defaultPrevented).toBe(false);

    const next = key("ArrowRight");
    window.dispatchEvent(next);
    expect(next.defaultPrevented).toBe(true);
    expect(steps).toEqual([b]);

    // ⌘⇧W puts the picture away, not the tab behind it.
    window.dispatchEvent(key("w", { metaKey: true, shiftKey: true }));
    expect(workspace.closeTab).not.toHaveBeenCalled();
    expect(stage.record.moves.at(-1)).toBe("land");
    expect(chat).not.toHaveBeenCalled();
  });

  it("holds a held Esc's repeats after it closes, so they don't reach the chat", () => {
    const listeners = workspaceKeyListeners(handlers);
    window.addEventListener("keydown", listeners.onKeyDownCapture, true);
    const chat = vi.fn();
    window.addEventListener("keydown", chat, true);
    const { viewer } = open([picture("blob:a")], SIZE);
    window.dispatchEvent(key("Escape"));
    viewer.detach();
    window.dispatchEvent(key("Escape", { repeat: true }));
    expect(chat).not.toHaveBeenCalled();
    vi.advanceTimersByTime(3000);
    window.dispatchEvent(key("Escape", { repeat: true }));
    expect(chat).toHaveBeenCalledOnce();
  });
});
