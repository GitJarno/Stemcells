import { describe, expect, it, vi } from "vite-plus/test";

import type { EnvironmentThreadShell } from "../upstream/cells";
import { alongBow, poseAt, segmentOf } from "./flight";
import {
  arrivalDone,
  arrive,
  arrivesNow,
  bumpNow,
  departs,
  hopFaded,
  hopLanded,
  hopsNow,
  inbound,
  pillStandsIn,
  resolveHops,
} from "./hops";

const at = (x: number, y: number, width: number, height: number) => ({
  measureInWindow: (callback: (x: number, y: number, width: number, height: number) => void) =>
    callback(x, y, width, height),
});
const thread = {} as EnvironmentThreadShell;
const figure = at(20, 300, 26, 28);
const hopOf = (key: string) => hopsNow().find((hop) => hop.key === key);
pillStandsIn(at(16, 760, 340, 36), ["awake", "asleep"]);

describe("a Cell moved by hand", () => {
  it("waits over its row, then flies to its new stage's segment, held from its count till it lands", () => {
    departs("env:waffle", thread, "awake", figure);
    resolveHops(
      () => true,
      () => true,
    );
    expect(hopOf("env:waffle")).toMatchObject({ toStage: null, to: null });
    resolveHops(
      (key, stage) => stage === "asleep",
      () => true,
    );
    expect(hopOf("env:waffle")).toMatchObject({
      from: { x: 20, y: 300, width: 26, height: 28 },
      toStage: "asleep",
      to: { x: 186, y: 762, width: 168, height: 32 },
    });
    expect(inbound(hopsNow(), "asleep", (key) => key === "env:waffle")).toBe(1);
    hopLanded("env:waffle");
    expect(hopOf("env:waffle")).toBeUndefined();
    expect(bumpNow()?.stage).toBe("asleep");
  });

  it("starts a new flight when moved again mid-air, not the old one's end", () => {
    departs("env:pancake", thread, "awake", figure);
    const leaping = hopOf("env:pancake")!.id;
    departs("env:pancake", thread, "asleep", figure);
    expect(hopOf("env:pancake")?.id).not.toBe(leaping);
    hopFaded("env:pancake");
  });

  it("moves when woken, though its machine hasn't listed it awake yet", () => {
    departs("env:toast", thread, "asleep", figure);
    resolveHops(
      () => false,
      () => true,
    );
    expect(hopOf("env:toast")?.toStage).toBe("awake");
    // Not yet counted in Awake: nothing to hold back.
    expect(inbound(hopsNow(), "awake", () => false)).toBe(0);
    hopLanded("env:toast");
  });

  it("fades where it waits when the move took it off the home, and comes back when it failed", () => {
    departs("env:crumb", thread, "awake", figure);
    resolveHops(
      () => false,
      () => false,
    );
    expect(hopOf("env:crumb")).toMatchObject({ fades: true, toStage: null });
    hopFaded("env:crumb");
    const back = departs("env:jam", thread, "awake", figure);
    back();
    expect(hopOf("env:jam")).toBeUndefined();
  });

  it("lands at once when the pill never says where it stands, so its count lets it go", () => {
    vi.useFakeTimers();
    pillStandsIn({ measureInWindow: () => undefined }, ["awake", "asleep"]);
    departs("env:bun", thread, "awake", figure);
    resolveHops(
      (key, stage) => stage === "asleep",
      () => true,
    );
    expect(hopOf("env:bun")?.toStage).toBe("asleep");
    vi.advanceTimersByTime(1000);
    expect(hopOf("env:bun")).toBeUndefined();
    vi.useRealTimers();
    pillStandsIn(at(16, 760, 340, 36), ["awake", "asleep"]);
  });

  it("flies no more than four at once; the rest only tick", () => {
    const keys = ["a", "b", "c", "d", "e"].map((name) => `env:${name}`);
    const backs = keys.map((key) => departs(key, thread, "awake", figure));
    expect(keys.map((key) => hopOf(key) !== undefined)).toEqual([true, true, true, true, false]);
    for (const back of backs) back();
  });
});

describe("a row entering a stage", () => {
  it("enters in the stage it entered until it has", () => {
    arrive(["env:muffin"], "awake", 0);
    expect(arrivesNow("env:muffin", "asleep", 1)).toBe(false);
    expect(arrivesNow("env:muffin", "awake", 1)).toBe(true);
    arrivalDone("env:muffin");
    expect(arrivesNow("env:muffin", "awake", 1)).toBe(false);
  });

  it("forgets an entrance not seen for ten minutes", () => {
    arrive(["env:scone"], "asleep", 0);
    expect(arrivesNow("env:scone", "asleep", 10 * 60_000 - 1)).toBe(true);
    expect(arrivesNow("env:scone", "asleep", 10 * 60_000)).toBe(false);
  });
});

describe("a flight's way", () => {
  it("bows up between its ends, shrinking as it goes", () => {
    const from = { x: 0, y: 100, height: 28 };
    const to = { x: 200, y: 500, height: 13 };
    expect(alongBow(from, to, 40, 0)).toEqual(from);
    expect(alongBow(from, to, 40, 1)).toMatchObject({ x: 200, height: 13 });
    expect(alongBow(from, to, 40, 0.5)).toEqual({ x: 100, y: 260, height: 20.5 });
  });

  it("leaps between its poses, landing on the last", () => {
    const pose = (x: number) => ({ x, y: x, scaleX: 1, scaleY: 1, rotate: 0, opacity: 1 });
    const frames = { step: 10, poses: [pose(0), pose(4), pose(10)] };
    expect(poseAt(frames, -5).x).toBe(0);
    expect(poseAt(frames, 15).x).toBe(7);
    expect(poseAt(frames, 20).x).toBe(10);
    expect(poseAt(frames, 25).x).toBe(10);
  });

  it("finds a segment inside the control's track, the segments equal", () => {
    expect(segmentOf({ x: 10, y: 50, width: 304, height: 36 }, 0, 3)).toEqual({
      x: 12,
      y: 52,
      width: 100,
      height: 32,
    });
    expect(segmentOf({ x: 10, y: 50, width: 304, height: 36 }, 2, 3).x).toBe(212);
  });
});
