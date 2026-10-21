/**
 * The light holds while no one can see it: a window hidden or covered, or a
 * surface off screen (the tab pager keeps neighbours mounted beside the
 * window). Beside another app it keeps moving, stepped: a frozen wave reads
 * as a stalled Cell. Without this, three working Cells in a window no one
 * saw kept the GPU busy drawing their wave.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

import { type Sight, watchSight } from "./sight";

type Listener = () => void;

let windowListeners: Map<string, Listener>;
let documentListeners: Map<string, Listener>;
let hasFocus: boolean;
let visibility: DocumentVisibilityState;
let report: ((entries: { target: Element; isIntersecting: boolean }[]) => void) | null;
let observed: Set<Element>;

beforeEach(() => {
  vi.useFakeTimers();
  windowListeners = new Map();
  documentListeners = new Map();
  hasFocus = true;
  visibility = "visible";
  observed = new Set();
  report = null;
  vi.stubGlobal("window", {
    addEventListener: (type: string, listener: Listener) => windowListeners.set(type, listener),
    removeEventListener: (type: string) => windowListeners.delete(type),
  });
  vi.stubGlobal("document", {
    hasFocus: () => hasFocus,
    get visibilityState() {
      return visibility;
    },
    addEventListener: (type: string, listener: Listener) => documentListeners.set(type, listener),
    removeEventListener: (type: string) => documentListeners.delete(type),
  });
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      constructor(callback: typeof report) {
        report = callback;
      }
      observe(element: Element) {
        observed.add(element);
      }
      unobserve(element: Element) {
        observed.delete(element);
      }
      disconnect() {
        observed.clear();
      }
    },
  );
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const glass = {} as Element;
const onScreen = (isIntersecting: boolean) => report?.([{ target: glass, isIntersecting }]);

describe("how a lit surface can be seen", () => {
  it("says so once it is on screen in a window in use, and hidden when it goes off screen", () => {
    const told: Sight[] = [];
    const stop = watchSight(glass, (sight) => told.push(sight));
    expect(told).toEqual([]);
    onScreen(true);
    onScreen(false);
    expect(told).toEqual(["focused", "hidden"]);
    stop();
  });

  it("is unfocused while another app has the window's focus, and not while focus moves into one of its frames", () => {
    const told: Sight[] = [];
    const stop = watchSight(glass, (sight) => told.push(sight));
    onScreen(true);
    // Into a browser pane of the window's own: the page still has focus.
    windowListeners.get("blur")?.();
    vi.runAllTimers();
    expect(told).toEqual(["focused"]);
    // Another app, the window still showing beside it.
    hasFocus = false;
    windowListeners.get("blur")?.();
    vi.runAllTimers();
    expect(told).toEqual(["focused", "unfocused"]);
    hasFocus = true;
    windowListeners.get("focus")?.();
    expect(told).toEqual(["focused", "unfocused", "focused"]);
    stop();
  });

  it("is hidden while the window is, focused or not", () => {
    const told: Sight[] = [];
    const stop = watchSight(glass, (sight) => told.push(sight));
    onScreen(true);
    visibility = "hidden";
    documentListeners.get("visibilitychange")?.();
    hasFocus = false;
    windowListeners.get("blur")?.();
    vi.runAllTimers();
    visibility = "visible";
    documentListeners.get("visibilitychange")?.();
    expect(told).toEqual(["focused", "hidden", "unfocused"]);
    stop();
  });

  it("stops telling when asked, and the last to stop stops listening", () => {
    const first: Sight[] = [];
    const second: Sight[] = [];
    const stopFirst = watchSight(glass, (sight) => first.push(sight));
    const stopSecond = watchSight(glass, (sight) => second.push(sight));
    onScreen(true);
    stopFirst();
    onScreen(false);
    expect(first).toEqual(["focused"]);
    expect(second).toEqual(["focused", "hidden"]);
    stopSecond();
    expect(observed.size).toBe(0);
    expect(windowListeners.size).toBe(0);
    expect(documentListeners.size).toBe(0);
  });
});
