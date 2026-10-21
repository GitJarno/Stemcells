import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

import { lookAt, mirroredKeys, ride, translation } from "./ride";

/** Frames, mutations and animations by hand: the rider's whole world. */
class HTMLElementStub {
  readonly stub = true;
}
class KeyframeEffectStub {
  constructor(
    readonly target: unknown,
    readonly keyframes: Record<string, unknown>[],
    readonly timing: Record<string, unknown>,
  ) {}
  getKeyframes() {
    return this.keyframes;
  }
  getTiming() {
    return this.timing;
  }
}

let frames: (() => void)[] = [];
let observers: { callback: () => void; filter: string[] }[] = [];

function frame(): void {
  const due = frames;
  frames = [];
  for (const callback of due) callback();
}

/** Every observer watching `attribute` hears a change. */
function changed(attribute: string): void {
  for (const observer of observers.filter((o) => o.filter.includes(attribute))) {
    observer.callback();
  }
}

const rect = (left: number, top: number, width: number, height: number) => ({
  x: left,
  y: top,
  left,
  top,
  right: left + width,
  bottom: top + height,
  width,
  height,
});

function world() {
  const pages = Object.assign(new HTMLElementStub(), {
    moving: false,
    hasAttribute: (name: string) => name === "data-moving" && pages.moving,
    getBoundingClientRect: () => rect(56, 36, 1496, 936),
    getAnimations: () => [] as unknown[],
    parentElement: null,
  });
  const strip = Object.assign(new HTMLElementStub(), {
    x: 0,
    animations: [] as unknown[],
    getAnimations: () => strip.animations,
    offsetWidth: 1496,
    offsetHeight: 936,
    parentElement: pages,
  });
  const slot = { left: 1000, top: 36, width: 500, height: 936 };
  const anchor = {
    closest: () => pages,
    parentElement: strip,
    getBoundingClientRect: () => rect(slot.left + strip.x, slot.top, slot.width, slot.height),
  };
  const box = (width: number, height: number) => {
    const animated: {
      frames: Keyframe[];
      options: KeyframeAnimationOptions;
      animation: { startTime: number | null; cancel: () => void };
    }[] = [];
    return {
      style: { transform: "", clipPath: "" },
      offsetWidth: width,
      offsetHeight: height,
      animated,
      animate(frames: Keyframe[], options: KeyframeAnimationOptions) {
        const animation = { startTime: null as number | null, cancel: vi.fn() };
        animated.push({ frames, options, animation });
        return animation;
      },
    };
  };
  const view = box(500, 936);
  const content = box(500, 936);
  const placed = { x: 1000, y: 36 };
  const rest = vi.fn(() => {
    // The slot presents again where it is.
    placed.x = Math.round(slot.left + strip.x);
  });
  const stop = ride({
    anchor: anchor as unknown as HTMLElement,
    view: () => ({
      element: view as unknown as HTMLElement,
      content: content as unknown as HTMLElement,
      ...placed,
    }),
    rest,
  });
  return { pages, strip, view, content, rest, stop };
}

beforeEach(() => {
  frames = [];
  observers = [];
  vi.stubGlobal("requestAnimationFrame", (callback: () => void) => frames.push(callback));
  vi.stubGlobal("cancelAnimationFrame", () => {
    frames = [];
  });
  vi.stubGlobal(
    "MutationObserver",
    class {
      readonly entry: { callback: () => void; filter: string[] };
      constructor(callback: () => void) {
        this.entry = { callback, filter: [] };
      }
      observe(_: unknown, options: { attributeFilter: string[] }) {
        this.entry.filter = options.attributeFilter;
        observers.push(this.entry);
      }
      disconnect() {
        observers = observers.filter((o) => o !== this.entry);
      }
    },
  );
  vi.stubGlobal("HTMLElement", HTMLElementStub);
  vi.stubGlobal("KeyframeEffect", KeyframeEffectStub);
  vi.stubGlobal("getComputedStyle", (element: { x: number }) => ({
    transform: `matrix(1, 0, 0, 1, ${element.x}, 0)`,
  }));
  vi.stubGlobal(
    "DOMMatrixReadOnly",
    class {
      readonly m41: number = 0;
      readonly m42: number = 0;
      constructor(matrix?: string) {
        const values = matrix?.match(/-?[\d.]+/g)?.map(Number);
        if (values) [this.m41, this.m42] = [values[4] ?? 0, values[5] ?? 0];
      }
    },
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("a browser rides the page it sits on", () => {
  it("at rest it is left where upstream placed it", () => {
    const { view } = world();
    frame();
    expect(view.style.transform).toBe("");
    expect(frames).toHaveLength(0);
  });

  it("follows each stroke of the fingers in the frame it is drawn", () => {
    const { pages, strip, view, content } = world();
    pages.moving = true;
    changed("data-moving");
    // The pager writes the strip after our frame callback ran.
    strip.x = -300;
    changed("style");
    expect(view.style.transform).toBe("translate3d(-300px, 0px, 0)");
    expect(content.style.clipPath).toBe("");
  });

  it("is cut where its page leaves the pages' frame", () => {
    const { pages, strip, view, content } = world();
    pages.moving = true;
    changed("data-moving");
    strip.x = -1100;
    changed("style");
    // The slot spans -100..400; the frame starts at 56. The view moves; its content is cut.
    expect(view.style.transform).toBe("translate3d(-1100px, 0px, 0)");
    expect(content.style.clipPath).toBe("inset(0% 0% 0% 31.2%)");
  });

  it("rides a slide as copies of it, with its timing, from its start", () => {
    const { pages, strip, view, content } = world();
    pages.moving = true;
    changed("data-moving");
    const timing = { duration: 420, delay: 0, easing: "linear(0, 1)", iterations: 1 };
    const keys = [
      { offset: 0, computedOffset: 0, easing: "linear", transform: "translate3d(0%, 0, 0)" },
      { offset: 1, computedOffset: 1, easing: "linear", transform: "translate3d(-100%, 0, 0)" },
    ];
    strip.animations = [
      {
        playState: "running",
        startTime: 1234,
        effect: new KeyframeEffectStub(strip, keys, timing),
      },
    ];
    frame();
    // The view's copy moves it; its content's copy cuts it, on a box the
    // compositor doesn't move from the main thread.
    expect(view.animated).toHaveLength(1);
    expect(content.animated).toHaveLength(1);
    const [move] = view.animated;
    const [cut] = content.animated;
    for (const copy of [move, cut]) {
      expect(copy?.options).toMatchObject({ duration: 420, easing: "linear(0, 1)" });
      expect(copy?.animation.startTime).toBe(1234);
    }
    expect(move?.frames.at(0)).toEqual({ offset: 0, transform: "none" });
    expect(move?.frames.at(-1)).toEqual({ offset: 1, transform: "translate3d(-1496px, 0px, 0)" });
    // The slot's left edge crosses the frame's at 944 / 1496 of the way.
    expect(cut?.frames.map((key) => key.offset)).toEqual([0, 944 / 1496, 1]);
    expect(cut?.frames.at(1)).toMatchObject({ clipPath: "inset(0%)" });
    // Once both are done, the view stays where the slide ends.
    expect(view.style.transform).toBe("translate3d(-1496px, 0px, 0)");
    // Frames while the slide runs leave the copies alone.
    frame();
    expect(view.animated).toHaveLength(1);
  });

  it("when the pages rest, its slot presents again and the transform goes", () => {
    const { pages, strip, view, rest } = world();
    pages.moving = true;
    changed("data-moving");
    strip.x = -40;
    changed("style");
    expect(view.style.transform).not.toBe("");
    strip.x = 0;
    pages.moving = false;
    changed("data-moving");
    expect(rest).toHaveBeenCalledOnce();
    expect(view.style.transform).toBe("");
    expect(frames).toHaveLength(0);
  });

  it("lets go of the view when its slot goes", () => {
    const { pages, strip, view, content, stop } = world();
    pages.moving = true;
    changed("data-moving");
    strip.x = -1100;
    changed("style");
    stop();
    expect(view.style.transform).toBe("");
    expect(content.style.clipPath).toBe("");
    expect(observers).toHaveLength(0);
  });
});

describe("the pieces of a ride", () => {
  it("reads a keyframe's translation in pixels, and nothing else", () => {
    const box = { width: 1000, height: 500 };
    expect(translation("translate3d(-150%, 0, 0)", box)).toEqual({ x: -1500, y: 0 });
    expect(translation("translateX(20px)", box)).toEqual({ x: 20, y: 0 });
    expect(translation("translate(10px, 50%)", box)).toEqual({ x: 10, y: 250 });
    expect(translation("none", box)).toEqual({ x: 0, y: 0 });
    expect(translation("matrix(1, 0, 0, 1, 10, 0)", box)).toBeNull();
    expect(translation("translate3d(10, 0, 0)", box)).toBeNull();
  });

  it("cuts in percent of the content's box", () => {
    const frame = { left: 56, top: 36, right: 1552, bottom: 972 };
    const size = { width: 500, height: 936 };
    expect(
      lookAt({ x: 0, y: 0 }, { left: 100, top: 36, right: 600, bottom: 972 }, size, frame),
    ).toEqual({ transform: "", clipPath: "" });
    expect(
      lookAt({ x: -94, y: 0 }, { left: 6, top: 36, right: 506, bottom: 972 }, size, frame),
    ).toEqual({ transform: "translate3d(-94px, 0px, 0)", clipPath: "inset(0% 0% 0% 10%)" });
  });

  it("keys the cut where the slot crosses the pages' edge", () => {
    const keys = mirroredKeys(
      [
        { offset: 0, transform: { x: 0, y: 0 } },
        { offset: 1, transform: { x: -1000, y: 0 } },
      ],
      { left: 900, top: 36, right: 1400, bottom: 972 },
      { width: 500, height: 936 },
      { x: 0, y: 0 },
      { x: 900, y: 36 },
      { left: 56, top: 36, right: 1552, bottom: 972 },
    );
    expect(keys.map((key) => key.offset)).toEqual([0, 0.844, 1]);
    expect(keys[1]).toMatchObject({ clipPath: "inset(0%)" });
    expect(keys[2]).toMatchObject({ clipPath: "inset(0% 0% 0% 31.2%)" });
  });
});
