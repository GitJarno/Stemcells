/**
 * A working Cell's wave runs on the compositor: what loops on the glass, the work word and
 * upstream's live overlays moves by transform or opacity only, since a background's place, a
 * gradient, a shadow or a filter stutters on a busy page. What never rests steps on the sprite
 * clock, a label repaints only while the crest crosses it, and unseen nothing loops.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

import {
  beat,
  beatEase,
  beatStart,
  beatWhen,
  CREST_REACH,
  crossing,
  eachBeat,
  paintedCrossing,
  sweepFrames,
} from "../motion/beat";
import { timing } from "../tokens/motion";
import { GlassLight } from "./motion";

/** What a compositor runs on its own. */
const COMPOSITED = new Set(["transform", "opacity"]);
/** A keyframe's bookkeeping, not a property. */
const TIMING = new Set(["offset", "easing", "composite", "computedOffset"]);

const TOKENS: Record<string, string> = {
  "--sc-timing-glow-pass": "3200ms",
  "--sc-timing-glow-rest": "1000ms",
  "--sc-timing-glow-lead": "200ms",
  "--sc-timing-glow-arrive": "450ms",
  "--sc-timing-glow-exhale": "650ms",
  "--sc-timing-glow-bloom": "450ms",
  "--sc-timing-glow-fade": "300ms",
  "--sc-timing-glow-breath": "3200ms",
  "--sc-timing-glow-drift": "9000ms",
  "--sc-timing-form-step": "83.333ms",
};

interface Played {
  frames: Keyframe[];
  readonly options: KeyframeAnimationOptions;
  cancelled: boolean;
}

let played: Played[] = [];

/** What a re-aim changes: the frames, never the timing or the phase. */
class Effect {
  constructor(private readonly entry: Played) {}
  setKeyframes(frames: Keyframe[]) {
    this.entry.frames = frames;
  }
}

function part() {
  const attributes = new Set<string>();
  return {
    style: Object.assign({}, { setProperty: () => undefined }) as unknown as CSSStyleDeclaration,
    setAttribute: (name: string) => attributes.add(name),
    removeAttribute: (name: string) => attributes.delete(name),
    hasAttribute: (name: string) => attributes.has(name),
    animate(frames: Keyframe[], options: KeyframeAnimationOptions) {
      const entry: Played = { frames, options, cancelled: false };
      played.push(entry);
      return {
        startTime: null,
        effect: new Effect(entry),
        finished: new Promise(() => undefined),
        cancel: () => {
          entry.cancelled = true;
        },
      };
    },
  } as unknown as HTMLElement;
}

function glass() {
  return new GlassLight({
    light: part(),
    lit: part(),
    wash: part(),
    near: part(),
    far: part(),
    band: part(),
    bloom: part(),
  });
}

const INK = {
  tone: [16, 163, 127],
  warm: [253, 190, 72],
  glass: [28, 28, 28],
  lightInk: true,
} as const;

/** Every property an endless animation moves. */
const looping = () =>
  played
    .filter(({ options }) => options.iterations === Infinity)
    .flatMap(({ frames }) => frames.flatMap((frame) => Object.keys(frame)))
    .filter((key) => !TIMING.has(key));

/** The endless animations still running. */
const endless = () =>
  played.filter(({ options, cancelled }) => options.iterations === Infinity && !cancelled);

const property = (frame: Keyframe) => Object.keys(frame).find((key) => !TIMING.has(key));

beforeEach(() => {
  played = [];
  vi.stubGlobal("KeyframeEffect", Effect);
  vi.stubGlobal("document", { documentElement: {} });
  vi.stubGlobal("getComputedStyle", () => ({
    opacity: "0",
    getPropertyValue: (name: string) => TOKENS[name] ?? "",
  }));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("the working wave runs on the compositor", () => {
  it("everything that loops on a working composer's glass moves by transform or opacity", () => {
    const light = glass();
    light.layout({ width: 736, height: 98 }, { x: 704, y: 66 }, 32, { left: 240, width: 1216 });
    light.configure("working", INK, false, true);
    const moved = looping();
    expect(moved).toContain("transform");
    for (const property of moved) expect(COMPOSITED, property).toContain(property);
  });

  it("the same while the glass asks for you and breathes", () => {
    const light = glass();
    light.layout({ width: 736, height: 98 }, { x: 704, y: 66 }, 32, { left: 240, width: 1216 });
    light.configure("needsYou", INK, false, true);
    for (const property of looping()) expect(COMPOSITED, property).toContain(property);
  });

  it("holds still under reduced motion: nothing loops", () => {
    const light = glass();
    light.layout({ width: 736, height: 98 }, { x: 704, y: 66 }, 32, { left: 240, width: 1216 });
    light.configure("working", INK, true, true);
    expect(looping()).toEqual([]);
    light.configure("needsYou", INK, true);
    expect(looping()).toEqual([]);
  });

  it("the work word's sheen and upstream's overlays slide by transform alone", () => {
    for (const frame of sweepFrames(-300, 1500, 3200 / 4200)) {
      for (const key of Object.keys(frame).filter((key) => !TIMING.has(key))) {
        expect(key).toBe("transform");
      }
    }
  });
});

describe("one wave over the pane", () => {
  it("puts every band's crest at the same place in the pane, wherever the band stands", () => {
    // The glass's band (184 px half), the word's (18) and a row's overlay (36), at their places.
    const pane = 1216;
    const share = 3200 / 4200;
    const crestAt = (left: number, crest: number, time: number) => {
      const { from, to } = crossing(pane, left, crest);
      return left + crest + from + (to - from) * beatEase(time / share);
    };
    for (const time of [0, 0.1, 0.33, 0.5, 0.7]) {
      const glassCrest = crestAt(240, 184, time);
      expect(crestAt(20, 18, time)).toBeCloseTo(glassCrest, 6);
      expect(crestAt(-36, 36, time)).toBeCloseTo(glassCrest, 6);
    }
    expect(crestAt(240, 184, 0)).toBeCloseTo(-CREST_REACH, 6);
    expect(crestAt(240, 184, share)).toBeCloseTo(pane + CREST_REACH, 6);
  });

  it("reads the beat from the timing tokens", () => {
    expect(beat()).toEqual({ pass: 3200, rest: 1000, period: 4200 });
  });

  it("runs its curve backwards exactly", () => {
    for (const time of [0, 0.2, 0.5, 0.9, 1]) expect(beatWhen(beatEase(time))).toBeCloseTo(time, 6);
  });
});

describe("a shining label, which can only repaint", () => {
  const place = (frame: Keyframe) => Number.parseFloat(String(frame.backgroundPosition));
  const label = () =>
    paintedCrossing(-520, 1180, -72, 126, (x) => ({ backgroundPosition: `${x}px 0, 0 0` }));

  it("starts with its band just off the label and ends just past it", () => {
    const { frames } = label();
    expect(place(frames[0]!)).toBe(-72);
    expect(place(frames.at(-1)!)).toBe(126);
    for (const frame of frames) {
      expect(Object.keys(frame).filter((key) => !TIMING.has(key))).toEqual(["backgroundPosition"]);
    }
  });

  it("runs only for the stretch of the beat the crest spends over it", () => {
    const { start, span } = label();
    expect(start).toBeGreaterThan(0);
    expect(start + span).toBeLessThanOrEqual(3200);
    expect(span / 4200).toBeGreaterThan(0);
    expect(span / 4200).toBeLessThan(0.15);
  });

  it("keeps to the crest while it crosses", () => {
    const { frames, start, span } = label();
    for (const frame of frames.slice(1, -1)) {
      const time = (start + (frame.offset ?? 0) * span) / 3200;
      expect(place(frame)).toBeCloseTo(-520 + 1700 * beatEase(time), 6);
    }
  });
});

describe("a stretch of every beat", () => {
  const PERIOD = 4200;
  const beatAt = beatStart(PERIOD) + PERIOD * 1000;
  let now = 0;
  class Effect {
    duration = 0;
    setKeyframes() {}
    updateTiming({ duration }: { duration: number }) {
      this.duration = duration;
    }
  }
  let animation: { startTime: number | null; effect: Effect; finish?: () => void };
  const element = {
    animate(_frames: Keyframe[], { duration }: { duration: number }) {
      const effect = new Effect();
      effect.duration = duration;
      animation = {
        startTime: null,
        effect,
        addEventListener: (_type: string, finish: () => void) => {
          animation.finish = finish;
        },
      } as typeof animation;
      return animation;
    },
  } as unknown as Element;

  beforeEach(() => {
    vi.stubGlobal("KeyframeEffect", Effect);
    vi.stubGlobal("document", {
      documentElement: {},
      timeline: {
        get currentTime() {
          return now;
        },
      },
    });
  });

  it("starts at this beat's stretch while it is to come or under way, else the next beat's", () => {
    const shine = eachBeat(element);
    now = beatAt + 1000;
    shine.aim([], 1500, 200);
    expect(animation.startTime).toBeCloseTo(beatAt + 1500, 6);
    expect(animation.effect.duration).toBe(200);
    now = beatAt + 1600;
    shine.aim([], 1500, 200);
    expect(animation.startTime).toBeCloseTo(beatAt + 1500, 6);
    now = beatAt + 1800;
    shine.aim([], 1500, 250);
    expect(animation.startTime).toBeCloseTo(beatAt + PERIOD + 1500, 6);
    expect(animation.effect.duration).toBe(250);
  });

  it("runs once a beat: as it finishes it is set to start a beat on", () => {
    const shine = eachBeat(element);
    now = beatAt + 1000;
    shine.aim([], 1500, 200);
    now = beatAt + 1700;
    animation.finish?.();
    expect(animation.startTime).toBeCloseTo(beatAt + PERIOD + 1500, 6);
  });
});

const STEP = 83.333;

/**
 * Frames that step on the Cells' sprite clock: each holds (`step-end`) for
 * at least a beat of it under a linear easing, over `duration` ms. A sweep's
 * held end, which never changes, needn't.
 */
function expectStepped(frames: Keyframe[], duration: number): void {
  for (const [i, frame] of frames.slice(0, -1).entries()) {
    const next = frames[i + 1]!;
    if (property(frame) && frame[property(frame)!] === next[property(next)!]) continue;
    expect(frame.easing).toBe("step-end");
    expect(((next.offset ?? 0) - (frame.offset ?? 0)) * duration).toBeGreaterThanOrEqual(STEP - 1);
  }
}

describe("what never rests steps on the Cells' sprite clock", () => {
  const stepped = (entry: Played) => {
    expect(entry.options.easing ?? "linear").toBe("linear");
    expectStepped(entry.frames, Number(entry.options.duration));
  };

  it("the working glass's drift changes twelve times a second, on its curve and period", () => {
    const light = glass();
    light.layout({ width: 736, height: 98 }, { x: 704, y: 66 }, 32, { left: 240, width: 1216 });
    light.configure("working", INK, false, true);
    const drifts = endless().filter(({ frames }) => property(frames[0]!) === "opacity");
    expect(drifts).toHaveLength(2);
    for (const drift of drifts) {
      stepped(drift);
      expect(drift.options).toMatchObject({ duration: 4500, direction: "alternate" });
    }
    const near = drifts[0]!.frames.map((frame) => Number(frame.opacity));
    expect(near[0]).toBe(1);
    expect(near.at(-1)).toBe(0);
    // Eased in and out: slow at the ends, quicker through the middle.
    expect(near[0]! - near[1]!).toBeLessThan(near[26]! - near[27]!);
  });

  it("the breath of a glass that asks for you does the same", () => {
    const light = glass();
    light.layout({ width: 736, height: 98 }, { x: 704, y: 66 }, 32, { left: 240, width: 1216 });
    light.configure("needsYou", INK, false, true);
    const breaths = endless();
    expect(breaths).toHaveLength(1);
    stepped(breaths[0]!);
  });
});

describe("a glass beside another app keeps moving, stepped", () => {
  const working = () => {
    const light = glass();
    light.layout({ width: 736, height: 98 }, { x: 704, y: 66 }, 32, { left: 240, width: 1216 });
    return light;
  };
  const band = () => endless().find(({ frames }) => property(frames[0]!) === "transform")!;

  it("crosses on the sprite clock, on the same beat, and glides again once in use", () => {
    const light = working();
    light.configure("working", INK, false, true);
    const sweep = band();
    expect(sweep.frames[0]!.easing).toContain("cubic-bezier");
    light.see("unfocused");
    // The same animation, re-aimed: its period and phase stay.
    expect(band()).toBe(sweep);
    expect(sweep.options).toMatchObject({ duration: 4200, iterations: Infinity });
    expectStepped(sweep.frames, 4200);
    expect(endless()).toHaveLength(3);
    light.see("focused");
    expect(band()).toBe(sweep);
    expect(sweep.frames[0]!.easing).toContain("cubic-bezier");
  });

  it("keeps the breath of a glass that asks for you pulsing", () => {
    const light = working();
    light.configure("needsYou", INK, false, true);
    light.see("unfocused");
    expect(endless()).toHaveLength(1);
  });

  it("starts stepped when the Cell starts work beside another app", () => {
    const light = working();
    light.see("unfocused");
    light.configure("working", INK, false, true);
    expectStepped(band().frames, 4200);
  });
});

describe("a stepped crest keeps to the gliding one", () => {
  it("holds each place the glide passes, a sprite beat apart, and rests where it does", () => {
    const share = 3200 / 4200;
    const frames = sweepFrames(-300, 1500, share, "", true);
    const at = (frame: Keyframe) =>
      Number(/translateX\((-?[\d.]+)px\)/.exec(String(frame.transform))![1]);
    expectStepped(frames, 4200);
    for (const frame of frames) {
      const time = (frame.offset ?? 0) / share;
      if (time <= 1) expect(at(frame)).toBeCloseTo(-300 + 1800 * beatEase(time), 6);
      expect(property(frame)).toBe("transform");
    }
    expect(frames.at(-2)).toMatchObject({ offset: share });
    expect(at(frames.at(-1)!)).toBe(1500);
  });

  it("and so does a shining label's, over the same stretch of the beat", () => {
    // A long label, which the crest takes several sprite beats to cross.
    const shine = (stepped: boolean) =>
      paintedCrossing(
        -520,
        1180,
        -72,
        640,
        (x) => ({ backgroundPosition: `${x}px 0, 0 0` }),
        stepped,
      );
    const smooth = shine(false);
    const stepped = shine(true);
    expect(stepped.start).toBe(smooth.start);
    expect(stepped.span).toBe(smooth.span);
    expect(stepped.frames.length).toBeGreaterThan(3);
    expectStepped(stepped.frames, stepped.span);
    expect(timing("formStep")).toBeCloseTo(STEP, 3);
  });

  it("lights a short label once, though the crest crosses it within a sprite beat", () => {
    const place = (frame: Keyframe) => Number.parseFloat(String(frame.backgroundPosition));
    const { frames, span } = paintedCrossing(
      -520,
      1180,
      300,
      330,
      (x) => ({ backgroundPosition: `${x}px 0, 0 0` }),
      true,
    );
    expect(span).toBeLessThan(STEP);
    expect(frames).toHaveLength(2);
    expect(place(frames[0]!)).toBeGreaterThan(300);
    expect(place(frames[0]!)).toBeLessThan(330);
  });
});

describe("a glass no one can see holds", () => {
  const working = () => {
    const light = glass();
    light.layout({ width: 736, height: 98 }, { x: 704, y: 66 }, 32, { left: 240, width: 1216 });
    return light;
  };

  it("stops every loop while hidden, and rejoins the beat when it can be seen again", () => {
    const light = working();
    light.configure("working", INK, false, true);
    expect(endless().length).toBeGreaterThan(0);
    light.see("hidden");
    expect(endless()).toEqual([]);
    light.see("focused");
    expect(
      endless()
        .map(({ frames }) => property(frames[0]!))
        .toSorted(),
    ).toEqual(["opacity", "opacity", "transform"]);
  });

  it("starts no loop while hidden, whatever the Cell does meanwhile", () => {
    const light = working();
    light.see("hidden");
    light.configure("working", INK, false, true);
    light.configure("needsYou", INK, false);
    expect(endless()).toEqual([]);
    light.see("unfocused");
    expect(endless()).toHaveLength(1);
  });
});
