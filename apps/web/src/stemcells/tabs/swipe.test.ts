import { describe, expect, it } from "vite-plus/test";

import {
  coastRate,
  LATCH_DISTANCE,
  LIFT_GAP,
  SwipeLatch,
  WheelContact,
  type Contact,
  type WheelSample,
} from "./swipe";

// Traces shaped like a Mac trackpad's wheel events: the fingers' deltas come
// at an uneven cadence and jitter, then, once they lift, the system's coast
// comes at the display's cadence and decays by a steady share per frame.

/** A seeded random source, so every trace is the same on every run. */
function random(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Trace {
  readonly samples: WheelSample[];
  /** Where the fingers' events end: samples from here on are the coast's. */
  readonly lift: number;
}

/** The fingers moving at `speeds` (px per event) along `angle`, each jittered by up to `jitter`, 7–13 ms apart. */
function fingers(
  speeds: readonly number[],
  options: { jitter: number; seed: number; angle?: number; start?: number },
): WheelSample[] {
  const next = random(options.seed);
  const angle = options.angle ?? 0;
  let t = options.start ?? 1000;
  return speeds.map((speed) => {
    t += 7 + next() * 6;
    const v = speed * (1 + (next() * 2 - 1) * options.jitter);
    return { dx: v * Math.cos(angle), dy: v * Math.sin(angle), t };
  });
}

/** The coast after `last`: its speed times `rate` each frame of `frame` ms, until it is under half a pixel. */
function coast(last: WheelSample, rate: number, frame = 1000 / 60): WheelSample[] {
  const perEvent = rate ** (frame / (1000 / 60));
  const samples: WheelSample[] = [];
  let { dx, dy, t } = last;
  while (Math.hypot(dx, dy) * perEvent >= 0.5) {
    dx *= perEvent;
    dy *= perEvent;
    t += frame;
    samples.push({ dx, dy, t });
  }
  return samples;
}

function flick(rate: number, seed: number, frame?: number): Trace {
  const moving = fingers([2, 5, 9, 14, 20, 26, 30, 32, 31, 30], { jitter: 0.25, seed });
  return { samples: [...moving, ...coast(moving.at(-1)!, rate, frame)], lift: moving.length };
}

function phases(samples: readonly WheelSample[], contact = new WheelContact()): Contact["phase"][] {
  return samples.map((sample) => contact.wheel(sample).phase);
}

describe("telling the fingers from the coast", () => {
  it("lets go within four events of a coast decaying 0.90 per frame, and not before", () => {
    const trace = flick(0.9, 1);
    const seen = phases(trace.samples);
    expect(seen[0]).toBe("began");
    expect(seen.slice(1, trace.lift)).toEqual(Array(trace.lift - 1).fill("moved"));
    const lifted = seen.indexOf("lifted");
    expect(lifted).toBeGreaterThanOrEqual(trace.lift);
    expect(lifted - trace.lift).toBeLessThanOrEqual(4);
    expect(seen.slice(lifted + 1).every((phase) => phase === "coasting")).toBe(true);
  });

  it("lets go of a slower coast, 0.96 per frame, as soon", () => {
    const trace = flick(0.96, 2);
    const seen = phases(trace.samples);
    const lifted = seen.indexOf("lifted");
    expect(lifted).toBeGreaterThanOrEqual(trace.lift);
    expect(lifted - trace.lift).toBeLessThanOrEqual(4);
    expect(seen.slice(lifted + 1).every((phase) => phase === "coasting")).toBe(true);
  });

  it("reads a coast at 120 Hz by its rate per frame, not per event", () => {
    const trace = flick(0.93, 3, 1000 / 120);
    const seen = phases(trace.samples);
    const lifted = seen.indexOf("lifted");
    expect(lifted).toBeGreaterThanOrEqual(trace.lift);
    expect(lifted - trace.lift).toBeLessThanOrEqual(4);
  });

  it("says how much of what it passed on as the fingers' move was the coast", () => {
    const trace = flick(0.94, 4);
    const contact = new WheelContact();
    const reports = trace.samples.map((sample) => contact.wheel(sample));
    const lifted = reports.findIndex((report) => report.phase === "lifted");
    const report = reports[lifted]!;
    if (report.phase !== "lifted") throw new Error("never lifted");
    const coastPassedOn = trace.samples
      .slice(trace.lift, lifted)
      .reduce((sum, sample) => sum + sample.dx, 0);
    // The run that gave the coast away starts one event before the coast
    // does, so it may count one coast event as the fingers' last.
    expect(report.coasted.dx).toBeLessThanOrEqual(coastPassedOn + 1e-9);
    expect(report.coasted.dx).toBeGreaterThanOrEqual(coastPassedOn - trace.samples[lifted]!.dx * 2);
  });

  it("holds on through a slow drag, and lets go once the fingers have been still for the gap", () => {
    const speeds = Array.from({ length: 50 }, (_, i) => 1 + 3 * Math.abs(Math.sin(i / 7)));
    const drag = fingers(speeds, { jitter: 0.3, seed: 5 });
    const contact = new WheelContact();
    const seen = phases(drag, contact);
    expect(seen[0]).toBe("began");
    expect(seen.slice(1).every((phase) => phase === "moved")).toBe(true);
    const last = drag.at(-1)!.t;
    expect(contact.idle(last + LIFT_GAP - 10)).toBe(false);
    expect(contact.idle(last + LIFT_GAP + 1)).toBe(true);
    // Once per gesture.
    expect(contact.idle(last + LIFT_GAP + 50)).toBe(false);
  });

  it("reads a coast in whole pixels", () => {
    const moving = fingers([3, 7, 12, 18, 24, 27, 26], { jitter: 0.25, seed: 10 }).map((s) => ({
      ...s,
      dx: Math.round(s.dx),
    }));
    const coasting = coast(moving.at(-1)!, 0.94).map((s) => ({ ...s, dx: Math.round(s.dx) }));
    const seen = phases([...moving, ...coasting]);
    const lifted = seen.indexOf("lifted");
    expect(lifted).toBeGreaterThanOrEqual(moving.length);
    expect(lifted - moving.length).toBeLessThanOrEqual(4);
  });

  it("doesn't take fingers slowing down unevenly for a coast", () => {
    let early = 0;
    for (let seed = 0; seed < 200; seed++) {
      const slowing = fingers([30, 27, 25, 22, 20, 18, 15, 13, 11, 9, 7, 5], {
        jitter: 0.15,
        seed: 100 + seed,
      });
      if (phases(slowing).includes("lifted")) early++;
    }
    // A Mac's coast is exact; fingers seldom slow down that evenly, and when
    // they do, the strip lets go a few pixels early and springs from there.
    expect(early / 200).toBeLessThan(0.03);
  });

  it("leaves a coast too slow to read to the silence after it", () => {
    const slow = fingers([1, 1.5, 1.5, 1.2], { jitter: 0, seed: 6 });
    const trace = [...slow, ...coast(slow.at(-1)!, 0.95)];
    const contact = new WheelContact();
    expect(phases(trace, contact)).not.toContain("lifted");
    expect(contact.idle(trace.at(-1)!.t + LIFT_GAP + 1)).toBe(true);
  });

  it("starts a new gesture when fingers touch down during a coast", () => {
    const trace = flick(0.95, 7);
    const contact = new WheelContact();
    const during = trace.samples.slice(0, trace.lift + 8);
    expect(phases(during, contact)).toContain("lifted");
    const t = during.at(-1)!.t;
    // Back the other way: the coast stops at once.
    expect(contact.wheel({ dx: -2, dy: 0, t: t + 12 }).phase).toBe("began");
    // The same way, faster than the coast would be by now.
    const again = flick(0.95, 8);
    const contact2 = new WheelContact();
    phases(again.samples.slice(0, again.lift + 8), contact2);
    const t2 = again.samples[again.lift + 7]!.t;
    const touch = [6, 12, 20].map((dx, i) => contact2.wheel({ dx, dy: 0, t: t2 + 10 * (i + 1) }));
    expect(touch.map((c) => c.phase)).toContain("began");
  });

  it("lets a coast go on through a pause the page took, judging it by its own times", () => {
    const trace = flick(0.95, 11);
    const contact = new WheelContact();
    const upTo = trace.lift + 8;
    expect(phases(trace.samples.slice(0, upTo), contact)).toContain("lifted");
    // The page was busy for 200 ms; the coast's next event comes stamped a frame on.
    expect(contact.idle(trace.samples[upTo - 1]!.t + 200)).toBe(false);
    expect(contact.wheel(trace.samples[upTo]!).phase).toBe("coasting");
  });

  it("takes a coast the page was too busy to hear, merged into one event, for the coast", () => {
    const trace = flick(0.95, 12);
    const contact = new WheelContact();
    const upTo = trace.lift + 6;
    expect(phases(trace.samples.slice(0, upTo), contact)).toContain("lifted");
    // 150 ms without a frame: the browser hands over the coast's events
    // from meanwhile as one, stamped with the last one's time.
    const busyFrom = trace.samples[upTo - 1]!.t + 2;
    const merged = trace.samples.slice(upTo, upTo + 9);
    const last = merged.at(-1)!;
    const sample = {
      dx: merged.reduce((sum, s) => sum + s.dx, 0),
      dy: 0,
      t: last.t,
      heard: busyFrom,
    };
    expect(contact.wheel(sample).phase).toBe("coasting");
    // And it goes on being the coast after.
    expect(
      phases(trace.samples.slice(upTo + 9, upTo + 20), contact).every((p) => p === "coasting"),
    ).toBe(true);
  });

  it("doesn't take a busy page's backlog of finger moves for a lift and a new touch", () => {
    const drag = fingers([4, 6, 8, 9, 9, 8, 9, 10], { jitter: 0.1, seed: 13 });
    const contact = new WheelContact();
    phases(drag, contact);
    const last = drag.at(-1)!;
    // The page drew nothing for 140 ms; the fingers moved on meanwhile.
    expect(contact.wheel({ dx: 120, dy: 0, t: last.t + 140, heard: last.t + 3 }).phase).toBe(
      "moved",
    );
    expect(contact.wheel({ dx: 9, dy: 0, t: last.t + 148 }).phase).toBe("moved");
  });

  it("doesn't take the moves a busy browser held back behind a touch for a lift and a new touch", () => {
    // The browser held the touch's first event back 180 ms, the page
    // drawing all the while; the fingers' moves from meanwhile come merged.
    const contact = new WheelContact();
    expect(contact.wheel({ dx: 3, dy: 0, t: 1000, got: 1180 }).phase).toBe("began");
    expect(contact.wheel({ dx: 158, dy: 0, t: 1058, got: 1181 }).phase).toBe("moved");
    expect(contact.wheel({ dx: 80, dy: 0, t: 1083, got: 1182 }).phase).toBe("moved");
    expect(contact.wheel({ dx: 403, dy: 0, t: 1183, got: 1190 }).phase).not.toBe("began");
  });

  it("takes the second merged event of a backlog for the coast, and the one before it too", () => {
    // The browser held a touch back 180 ms. What came meanwhile arrives one
    // kind at a time: the touch, the fingers' moves merged, the coast's
    // first event alone, the rest of the coast merged.
    const contact = new WheelContact();
    expect(contact.wheel({ dx: 2, dy: 0, t: 1000, got: 1180 }).phase).toBe("began");
    expect(contact.wheel({ dx: 67, dy: 0, t: 1042, got: 1188 }).phase).toBe("moved");
    expect(contact.wheel({ dx: 44, dy: 0, t: 1067, got: 1196 }).phase).toBe("moved");
    const lifted = contact.wheel({ dx: 226, dy: 0, t: 1183, got: 1204 });
    expect(lifted).toEqual({ phase: "lifted", coasted: { dx: 44, dy: 0 } });
    expect(contact.wheel({ dx: 17, dy: 0, t: 1200, got: 1212 }).phase).toBe("coasting");
  });

  it("follows a coast the browser held back, merged and stamped as late as its last step", () => {
    const trace = flick(0.95, 18);
    const contact = new WheelContact();
    const upTo = trace.lift + 6;
    expect(phases(trace.samples.slice(0, upTo), contact)).toContain("lifted");
    // 130 ms of the coast held back while the page drew on, handed over as one.
    const merged = trace.samples.slice(upTo, upTo + 8);
    const last = merged.at(-1)!;
    const sample = {
      dx: merged.reduce((sum, s) => sum + s.dx, 0),
      dy: 0,
      t: last.t,
      got: last.t + 4,
    };
    expect(contact.wheel(sample).phase).toBe("coasting");
    expect(contact.wheel(trace.samples[upTo + 8]!).phase).toBe("coasting");
  });

  it("goes on with the fingers' moves the browser held back, merged after a silence", () => {
    const drag = fingers([8, 9, 10, 11, 12, 13, 14, 14], { jitter: 0.05, seed: 19 });
    const contact = new WheelContact();
    phases(drag, contact);
    const last = drag.at(-1)!;
    expect(contact.idle(last.t + 90)).toBe(true);
    // 120 ms of moves at their pace, stamped as late as the last of them.
    expect(contact.wheel({ dx: 180, dy: 0, t: last.t + 120, got: last.t + 124 })).toEqual({
      phase: "moved",
      resumed: true,
    });
    // A touch after a silence starts small: that is a new gesture.
    expect(contact.idle(last.t + 220)).toBe(true);
    expect(contact.wheel({ dx: 3, dy: 0, t: last.t + 260, got: last.t + 270 }).phase).toBe("began");
  });

  it("starts a new gesture at once when fingers touch down the same way during a coast", () => {
    const trace = flick(0.95, 14);
    const contact = new WheelContact();
    const upTo = trace.lift + 5;
    expect(phases(trace.samples.slice(0, upTo), contact)).toContain("lifted");
    // The touch stops the coast; the fingers' first events are slower than it.
    const t = trace.samples[upTo - 1]!.t;
    expect(contact.wheel({ dx: 3, dy: 0, t: t + 9 }).phase).toBe("began");
    expect(contact.wheel({ dx: 7, dy: 0, t: t + 17 }).phase).toBe("moved");
  });

  it("ends a coast that went quiet while the page could hear", () => {
    const trace = flick(0.95, 15);
    const contact = new WheelContact();
    const upTo = trace.lift + 6;
    expect(phases(trace.samples.slice(0, upTo), contact)).toContain("lifted");
    const next = trace.samples[upTo]!;
    // The same speed the coast would have, but after a heard 60 ms pause: a touch.
    expect(contact.wheel({ ...next, t: trace.samples[upTo - 1]!.t + 60 }).phase).toBe("began");
  });

  it("follows a long whole-pixel coast to its last pixel", () => {
    // A coast as a Mac sends it on a 120 Hz display: whole pixels, a slow
    // decay, and a long tail of single pixels.
    const moving = fingers([4, 9, 15, 21, 26, 28], { jitter: 0.1, seed: 16 }).map((s) => ({
      ...s,
      dx: Math.round(s.dx),
    }));
    const coasting = coast(moving.at(-1)!, 0.95, 1000 / 120).map((s) => ({
      ...s,
      dx: Math.round(s.dx),
    }));
    const seen = phases([...moving, ...coasting]);
    const lifted = seen.indexOf("lifted");
    expect(lifted).toBeGreaterThanOrEqual(moving.length);
    expect(seen.slice(lifted + 1).every((phase) => phase === "coasting")).toBe(true);
  });

  it("counts a coast's first event as the coast's when it comes at the coast's slower pace", () => {
    // Fingers every 8 ms; the coast every 17 ms, its first step carrying the fingers' speed.
    const moving = fingers([3, 7, 11, 16, 22, 28, 34, 40], { jitter: 0, seed: 17 }).map((s, i) => ({
      ...s,
      t: 1000 + i * 8.3,
    }));
    const end = moving.at(-1)!.t;
    const coasting = Array.from({ length: 12 }, (_, i) => ({
      dx: Math.round(80 * 0.95 ** i),
      dy: 0,
      t: end + 16.7 * (i + 1),
    }));
    const contact = new WheelContact();
    const reports = [...moving, ...coasting].map((sample) => contact.wheel(sample));
    const lifted = reports.find((report) => report.phase === "lifted");
    if (lifted?.phase !== "lifted") throw new Error("never lifted");
    // Every coast event the fingers' move was told before the lift is given back.
    const told = coasting.slice(0, reports.indexOf(lifted) - moving.length);
    expect(lifted.coasted.dx).toBe(told.reduce((sum, s) => sum + s.dx, 0));
  });

  it("starts a new gesture after a silence", () => {
    const first = fingers([4, 6, 8], { jitter: 0, seed: 9 });
    const contact = new WheelContact();
    phases(first, contact);
    const after = first.at(-1)!.t + LIFT_GAP + 10;
    expect(contact.wheel({ dx: 3, dy: 0, t: after }).phase).toBe("began");
  });

  it("knows a coast's rate", () => {
    const run = [10, 9.4, 8.836, 8.306].map((dx, i) => ({ dx, dy: 0, t: (i * 1000) / 60 }));
    expect(coastRate(run)).toBeCloseTo(0.94, 3);
    expect(coastRate([10, 9, 9.5, 8].map((dx, i) => ({ dx, dy: 0, t: i * 16 })))).toBeNull();
  });
});

describe("whose gesture it is", () => {
  const noScroller = () => false;

  it("a horizontal swipe is the pager's once it passes the latch, from the latch on", () => {
    const latch = new SwipeLatch(noScroller);
    expect(latch.holds).toBe(true);
    expect(latch.move(3, 0.5)).toBe(0);
    expect(latch.holds).toBe(true);
    expect(latch.move(4, 0)).toBe(0);
    expect(latch.owner).toBe("pending");
    expect(latch.move(5, 1)).toBe(3 + 4 + 5 - LATCH_DISTANCE);
    expect(latch.owner).toBe("pager");
    expect(latch.move(-2, 7)).toBe(-2);
  });

  it("a vertical scroll is the page's, and never held", () => {
    const latch = new SwipeLatch(noScroller);
    latch.move(0.5, 3);
    expect(latch.holds).toBe(false);
    latch.move(0, 6);
    expect(latch.owner).toBe("page");
    expect(latch.move(20, 0)).toBe(0);
    expect(latch.holds).toBe(false);
  });

  it("a diagonal start goes to whichever way it has moved more by the latch", () => {
    const across = new SwipeLatch(noScroller);
    for (const [dx, dy] of [
      [3, 3],
      [3, 2.5],
      [4, 1],
    ] as const) {
      across.move(dx, dy);
    }
    expect(across.owner).toBe("pager");

    const down = new SwipeLatch(noScroller);
    for (const [dx, dy] of [
      [2, 3],
      [2, 3],
      [3, 4],
    ] as const) {
      down.move(dx, dy);
    }
    expect(down.owner).toBe("page");
  });

  it("a scroller under the fingers with room that way keeps the gesture", () => {
    const latch = new SwipeLatch((direction) => direction === 1);
    latch.move(4, 0);
    expect(latch.holds).toBe(false);
    latch.move(6, 0);
    expect(latch.owner).toBe("page");
  });

  it("a scroller at its end that way lets the pager have it", () => {
    const latch = new SwipeLatch((direction) => direction === 1);
    latch.move(-4, 0);
    expect(latch.holds).toBe(true);
    latch.move(-6, 0);
    expect(latch.owner).toBe("pager");
  });

  it("a hand on the strip while it still moves takes it at once, if it leans horizontal", () => {
    const catching = new SwipeLatch(noScroller, { catching: true });
    expect(catching.move(3, 1)).toBe(3);
    expect(catching.owner).toBe("pager");

    const scrolling = new SwipeLatch(noScroller, { catching: true });
    expect(scrolling.move(1, 3)).toBe(0);
    expect(scrolling.owner).toBe("pending");
  });

  it("a gesture the pager gave up goes nowhere, and stays held", () => {
    const latch = new SwipeLatch(noScroller);
    latch.move(12, 0);
    latch.spend();
    expect(latch.owner).toBe("spent");
    expect(latch.move(30, 0)).toBe(0);
    expect(latch.holds).toBe(true);
  });
});
