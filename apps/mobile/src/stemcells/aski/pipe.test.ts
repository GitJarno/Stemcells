import { describe, expect, it } from "vite-plus/test";

import { arriving, feedArriving, feedLeaving, leaving, PIPE } from "./pipe";

const REST = { scale: 1, squash: 1, lift: 0, opacity: 1 };
const close = (a: number, b: number) => expect(Math.abs(a - b)).toBeLessThan(1e-9);

describe("a figure through the pipe", () => {
  it("starts and ends at rest, so a turn begins and ends without a jump", () => {
    expect(leaving(0)).toEqual(REST);
    const end = arriving(PIPE.rise);
    close(end.scale, 1);
    close(end.squash, 1);
    close(end.lift, 0);
    expect(end.opacity).toBe(1);
  });

  it("is unseen in the pipe, and comes out as it went in", () => {
    const gone = leaving(PIPE.dive);
    const coming = arriving(0);
    close(gone.opacity, 0);
    expect(coming.opacity).toBe(0);
    close(gone.scale, coming.scale);
    close(gone.lift, coming.lift);
    expect(arriving(-PIPE.stagger)).toEqual(coming);
  });

  it("jumps toward the person before it goes down, and comes out past its size", () => {
    const grown = (at: (ms: number) => { scale: number }, over: number) =>
      Math.max(...Array.from({ length: over + 1 }, (_, ms) => at(ms).scale));
    expect(grown(leaving, PIPE.dive)).toBeGreaterThan(1.2);
    expect(grown(arriving, PIPE.rise)).toBeGreaterThan(1.1);
  });

  it("moves without a step from one millisecond to the next", () => {
    for (const [at, over] of [
      [leaving, PIPE.dive],
      [arriving, PIPE.rise],
    ] as const)
      for (let ms = 0; ms < over; ms++) {
        expect(Math.abs(at(ms + 1).scale - at(ms).scale)).toBeLessThan(0.03);
        expect(Math.abs(at(ms + 1).lift - at(ms).lift)).toBeLessThan(0.6);
      }
  });
});

describe("a chat's feed in a turn", () => {
  it("is out before the chat turns under it, and comes back whole", () => {
    expect(feedLeaving(0)).toBe(1);
    expect(feedLeaving(PIPE.feedOut)).toBe(0);
    expect(PIPE.feedOut).toBeLessThanOrEqual(PIPE.dive);
    expect(feedArriving(0)).toBe(0);
    expect(feedArriving(PIPE.feedIn)).toBe(1);
  });
});
