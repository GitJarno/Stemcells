import { describe, expect, it } from "vite-plus/test";

import { HOME_PACE, wordCentre } from "../cell/toss";
import type { Rect } from "./arrangement";
import {
  advance,
  type Arena,
  centreAt,
  grab,
  handVelocity,
  hold,
  isFlying,
  isHome,
  letGo,
  letGoOf,
  recordHand,
  type Sample,
  setDown,
  type ThrowTimes,
  throwCell,
  type Thrown,
  tierOf,
  TOSS_SPEED,
  tossOf,
} from "./throw";
import golden from "./throw.golden.json" with { type: "json" };
import {
  groundedOf,
  hasLanded,
  type Impact,
  type Motion,
  stepMotion,
  throwMotion,
  velocityOf,
} from "./throwWorld";

// The golden flights are the Swift original's own: the original app's
// MochiWorld.swift, MochiToss.swift, CritterToss.swift and CritterBonk.swift
// compiled as they are and driven as CritterTossView.tick drives a thrown
// Cell, at 120 Hz and 60 Hz (stemcells/scripts/throw-golden.swift).

const [bx, by, bw, bh] = golden.bounds as [number, number, number, number];
const BOUNDS: Rect = { x: bx, y: by, width: bw, height: bh };
const BOX = { width: golden.box[0]!, height: golden.box[1]! };
const EXTENT = { width: golden.extent[0]!, height: golden.extent[1]! };
/** Home in the middle of the floor line. */
const ARENA: Arena = { bounds: BOUNDS, home: bx + bw / 2 };
const TIMES: ThrowTimes = {
  dizzy: golden.dizzy * 1000,
  bearings: 350,
  wordLife: golden.wordLife * 1000,
};
const point = (p: ReadonlyArray<number>) => ({ x: p[0]!, y: p[1]! });

/** How a golden flight was thrown. */
interface Throw {
  readonly start: ReadonlyArray<number>;
  readonly velocity: ReadonlyArray<number>;
  readonly grip: ReadonlyArray<number>;
}

/** A golden flight's Cell, thrown at time 0 and flown on ticks of `hz`, its motion read after each. */
function flyMotion(flight: Throw, hz: number, until: number) {
  let motion = throwMotion(point(flight.start), point(flight.velocity), BOX, point(flight.grip));
  const ticks: { t: number; motion: Motion; impacts: Impact[] }[] = [];
  for (let tick = 1; tick / hz <= until + 1e-9; tick++) {
    const stepped = stepMotion(motion, 1 / hz, BOUNDS);
    motion = stepped.motion;
    ticks.push({ t: tick / hz, motion, impacts: stepped.frames.flatMap((frame) => frame.impacts) });
  }
  return ticks;
}

/** A thrown Cell flown on ticks of `hz` (ms apart) from `at`, until it is home or `until` ms. */
function fly(thrown: Thrown, hz: number, until = 12_000, arena = ARENA) {
  const states: Thrown[] = [];
  let now = thrown.at;
  for (let tick = 1; now < until; tick++) {
    now = thrown.at + (tick * 1000) / hz;
    const next = advance(states.at(-1) ?? thrown, now, arena, TIMES);
    states.push(next);
    if (isHome(next, arena, now)) break;
  }
  return states;
}

const thrownFrom = (flight: Throw) =>
  throwCell(point(flight.start), point(flight.velocity), BOX, point(flight.grip), 0);

describe("a thrown Cell flies as the original's does", () => {
  it.each(golden.flights)("$name: the same path, contacts and landing at 120 Hz", (flight) => {
    const last = flight.points.at(-1)![0]!;
    const ticks = flyMotion(flight, 120, last);
    for (const [t, x, y, vx, vy, grounded, landed] of flight.points) {
      const at = ticks[Math.round(t! * 120) - 1]!;
      expect(at.t).toBeCloseTo(t!, 9);
      expect(at.motion.position.x).toBeCloseTo(x!, 6);
      expect(at.motion.position.y).toBeCloseTo(y!, 6);
      const v = velocityOf(at.motion);
      expect(v.x).toBeCloseTo(vx!, 6);
      expect(v.y).toBeCloseTo(vy!, 6);
      expect(groundedOf(at.motion)).toBe(grounded === 1);
      expect(hasLanded(at.motion)).toBe(landed === 1);
    }
    const impacts = ticks.flatMap((tick) =>
      tick.impacts.map((impact) => ({ t: tick.t, surface: impact.surface, speed: impact.speed })),
    );
    expect(impacts.length).toBe(flight.impacts.length);
    flight.impacts.forEach((want, index) => {
      expect(impacts[index]!.t).toBeCloseTo(want.t, 9);
      expect(impacts[index]!.surface).toBe(want.surface);
      expect(impacts[index]!.speed).toBeCloseTo(want.speed, 6);
    });
    const landedAt = ticks.find((tick) => hasLanded(tick.motion))?.t;
    expect(landedAt).toBeCloseTo(flight.landedAt, 9);
    if (flight.restAt !== null) {
      expect(ticks.find((tick) => tick.motion.resting)?.t).toBeCloseTo(flight.restAt, 9);
    }
  });

  it.each(golden.flights)("$name: the same words, dizzy beat and way home", (flight) => {
    const states = fly(thrownFrom(flight), 120);
    // Every word said, a word said over the last one in its place.
    const said = [...new Map(states.flatMap((s) => s.words).map((w) => [w.at, w])).values()];
    const words: typeof said = [];
    for (const word of said) {
      if (words.length > 0 && word.at - words.at(-1)!.at < 120) words.pop();
      words.push(word);
    }
    const wanted: typeof flight.words = [];
    for (const word of flight.words) {
      if (word.replaced) wanted.pop();
      wanted.push(word);
    }
    expect(words.map((word) => [word.tier, word.surface])).toEqual(
      wanted.map((w) => [w.tier, w.surface]),
    );
    // Where each word is said, as the original places it: by the body at
    // the world frame of the hit (the original's own tick drew it up to a
    // frame behind, `x` and `y`).
    wanted.forEach((want, index) => {
      const word = words[index]!;
      const at = wordCentre(word.surface, EXTENT, word.body, word.bounds, word.heading);
      expect(at.x).toBeCloseTo(want.fx, 6);
      expect(at.y).toBeCloseTo(want.fy, 6);
    });
    const end = states.at(-1)!;
    expect(end.dizzyFrom !== null).toBe(flight.dizzy);
    // The original judges on its display's ticks, this on the world's
    // frames: its dizzy beat starts a tick later at most, and it goes home
    // on the first tick after the beat has ended, two ticks later at most.
    const tick = 1000 / 120;
    if (flight.dizzyFrom !== null) {
      expect(flight.dizzyFrom * 1000 - end.dizzyFrom!).toBeGreaterThanOrEqual(0);
      expect(flight.dizzyFrom * 1000 - end.dizzyFrom!).toBeLessThan(tick);
    }
    const home = flight.homeAt! * 1000 - (end.setsOff! - TIMES.bearings);
    expect(home).toBeGreaterThanOrEqual(-1e-6);
    expect(home).toBeLessThan(2 * tick);
  });

  it("is the original at 60 Hz too: the same contacts and the same place down", () => {
    for (const flight of golden.flights60) {
      const ticks = flyMotion(flight, 60, flight.homeAt!);
      const impacts = ticks.flatMap((tick) =>
        tick.impacts.map((impact) => [impact.surface, impact.speed]),
      );
      expect(impacts.map(([surface]) => surface)).toEqual(flight.impacts.map((i) => i.surface));
      impacts.forEach(([, speed], index) =>
        expect(speed).toBeCloseTo(flight.impacts[index]!.speed, 6),
      );
      const end = ticks.at(-1)!.motion.position;
      expect(end.x).toBeCloseTo(flight.end[0]!, 6);
      expect(end.y).toBeCloseTo(flight.end[1]!, 6);
    }
  });

  it("is caught mid-air, carried, and thrown again as the original is", () => {
    const want = golden.regrab;
    const dt = 1000 / 120;
    let thrown = throwCell({ x: 200, y: 400 }, { x: 700, y: -600 }, BOX, { x: 0, y: 0 }, 0);
    const caught: number[] = [];
    const released: number[] = [];
    const points: number[][] = [];
    for (let tick = 1; tick <= 480; tick++) {
      const now = tick * dt;
      const t = tick / 120;
      // The original steps the whole tick after the hand's events in it.
      if (t >= 0.3 && t < 0.4) {
        const k = (t - 0.3) / 0.1;
        const hand: Sample = { x: 330 + 300 * k, y: 260 - 200 * k, at: now };
        if (!thrown.motion.held) {
          const at = centreAt(thrown, ARENA, now);
          thrown = { ...grab(thrown, hand, ARENA), at: now - dt };
          caught.push(t, at.x, at.y, thrown.grip.x, thrown.grip.y);
        }
        thrown = hold(thrown, hand, ARENA);
      } else if (thrown.motion.held) {
        const hand: Sample = { x: 630, y: 60, at: now };
        const held = hold(thrown, hand, ARENA);
        const v = handVelocity(held.hand, now);
        thrown = { ...letGo(thrown, hand, ARENA), at: now - dt };
        released.push(t, thrown.motion.position.x, thrown.motion.position.y, v.x, v.y);
      }
      thrown = advance(thrown, now, ARENA, TIMES);
      if (tick % 6 === 0) {
        const at = thrown.motion.position;
        points.push([t, at.x, at.y, thrown.motion.held ? 1 : 0]);
      }
      if (thrown.motion.resting) break;
    }
    caught.forEach((value, i) => expect(value).toBeCloseTo(want.caught[i]!, 6));
    released.forEach((value, i) => expect(value).toBeCloseTo(want.released[i]!, 6));
    want.points.forEach((p, i) => {
      expect(points[i]![0]).toBeCloseTo(p[0]!, 9);
      expect(points[i]![1]).toBeCloseTo(p[1]!, 6);
      expect(points[i]![2]).toBeCloseTo(p[2]!, 6);
      expect(points[i]![3]).toBe(p[3]);
    });
    expect(thrown.motion.position.x).toBeCloseTo(want.end[0]!, 6);
    expect(thrown.motion.position.y).toBeCloseTo(want.end[1]!, 6);
  });
});

describe("the hand's speed as it lets go", () => {
  it.each(golden.hands)(
    "$name: the original's reading of the last 0.12 s, scaled by 0.55",
    (hand) => {
      const samples = hand.samples.reduce<Sample[]>(
        (kept, [x, y, t]) => recordHand(kept, { x: x!, y: y!, at: t! * 1000 }),
        [],
      );
      for (const [t, vx, vy] of hand.reads) {
        const v = handVelocity(samples, t! * 1000);
        expect(v.x).toBeCloseTo(vx!, 6);
        expect(v.y).toBeCloseTo(vy!, 6);
      }
    },
  );

  it("keeps at most 64 samples, in time order, and ignores one out of order", () => {
    let hand: Sample[] = [];
    for (let i = 0; i < 200; i++) hand = recordHand(hand, { x: i, y: 0, at: 1000 + i * 0.5 });
    expect(hand).toHaveLength(64);
    expect(recordHand(hand, { x: 0, y: 0, at: 1000 })).toEqual(hand);
  });
});

/** A Cell dropped still from `y` (its box's centre), on `hz` ticks. */
const dropped = (y: number, x = 400) => throwCell({ x, y }, { x: 0, y: 0 }, BOX, { x: 0, y: 0 }, 0);

describe("its contacts", () => {
  /** The motion on 120 Hz ticks until `stop` says so, with the tick it stopped on. */
  function until(motion: Motion, stop: (impacts: ReadonlyArray<Impact>) => boolean) {
    let before = motion;
    for (let tick = 0; tick < 2400; tick++) {
      const stepped = stepMotion(before, 1 / 120, BOUNDS);
      const impacts = stepped.frames.flatMap((frame) => frame.impacts);
      if (stop(impacts)) return { before, after: stepped.motion, impacts };
      before = stepped.motion;
    }
    throw new Error("never stopped");
  }

  it("a wall gives back 0.35 of what met it, flattens it and turns it round", () => {
    const flight = throwMotion({ x: 600, y: 300 }, { x: 1000, y: 0 }, BOX, { x: 0, y: 0 });
    const { before, after, impacts } = until(flight, (i) => i.some((x) => x.surface === "right"));
    expect(impacts[0]!.speed).toBeCloseTo(velocityOf(before).x, 6);
    expect(velocityOf(after).x / velocityOf(before).x).toBeCloseTo(-0.35, 6);
    expect(after.position.x + BOX.width / 2).toBeLessThanOrEqual(BOUNDS.x + BOUNDS.width + 1);
  });

  it("the top gives back 0.38 and presses it down", () => {
    const flight = throwMotion({ x: 400, y: 300 }, { x: 0, y: -1100 }, BOX, { x: 0, y: 0 });
    const { after, impacts } = until(flight, (i) => i.some((x) => x.surface === "ceiling"));
    const hit = impacts.find((x) => x.surface === "ceiling")!;
    expect(hit.point.y).toBe(BOUNDS.y);
    expect(velocityOf(after).y / -hit.speed).toBeCloseTo(-0.38, 6);
  });

  it("the floor gives back less the harder it lands, and a soft landing stays down", () => {
    const bounce = (y: number) => {
      const { after, impacts } = until(dropped(y).motion, (i) =>
        i.some((x) => x.surface === "floor"),
      );
      return { speed: impacts[0]!.speed, back: -velocityOf(after).y };
    };
    const hard = bounce(150);
    const soft = bounce(400);
    expect(hard.back / hard.speed).toBeLessThan(soft.back / soft.speed);
    // The world's restitution: 0.32 × (1 − v/700), never under 0.35 of it.
    expect(hard.back / hard.speed).toBeGreaterThan(0.32 * 0.35 - 0.02);
    expect(soft.back / soft.speed).toBeLessThan(0.32);
    // Dropped from a box's height, it never comes back up.
    let motion = dropped(BOUNDS.y + BOUNDS.height - 30).motion;
    let rose = false;
    for (let tick = 0; tick < 240; tick++) {
      motion = stepMotion(motion, 1 / 120, BOUNDS).motion;
      if (groundedOf(motion) && velocityOf(motion).y < 0) rose = true;
    }
    expect(rose).toBe(false);
    expect(hasLanded(motion)).toBe(true);
  });

  it("slides to a stop on its grip: 300 world px a second², 977 CSS px a second² at this size", () => {
    // Set down moving sideways: it brakes evenly, stopping where v²/2a says.
    const start = { x: 200, y: BOUNDS.y + BOUNDS.height - BOX.height / 2 };
    let motion = throwMotion(start, { x: 600, y: 0 }, BOX, { x: 0, y: 0 });
    for (let tick = 0; tick < 240; tick++) motion = stepMotion(motion, 1 / 120, BOUNDS).motion;
    expect(velocityOf(motion).x).toBe(0);
    const braking = 300 * (1400 / 430);
    // Within a pixel: its first substeps set it down before it slides.
    expect(Math.abs(motion.to.x - start.x - (600 * 600) / (2 * braking))).toBeLessThan(1);
  });

  it("never tumbles: an off-centre throw rolls its face until it lands facing front", () => {
    const flight = throwMotion({ x: 200, y: 300 }, { x: 500, y: -400 }, BOX, { x: 8, y: -9 });
    let motion = flight;
    let rolled = 0;
    for (let tick = 0; tick < 600; tick++) {
      motion = stepMotion(motion, 1 / 120, BOUNDS).motion;
      if (!groundedOf(motion)) rolled = Math.max(rolled, Math.abs(motion.world.body.spin));
    }
    expect(rolled).toBeGreaterThan(1);
    expect(motion.world.body.spin).toBe(0);
    const centred = throwMotion({ x: 200, y: 300 }, { x: 500, y: -400 }, BOX, { x: 0, y: 0 });
    expect(centred.world.body.spinV).toBe(0);
  });

  it("a release faster than 1100 CSS px a second is cut to it along its own direction", () => {
    const v = velocityOf(
      throwMotion({ x: 400, y: 300 }, { x: -2400, y: -1800 }, BOX, { x: 0, y: 0 }),
    );
    expect(Math.hypot(v.x, v.y)).toBeCloseTo(1100, 6);
    expect(v.y / v.x).toBeCloseTo(1800 / 2400, 9);
  });

  it("stays inside an arena that shrinks under it, and falls again when the floor goes lower", () => {
    let motion = dropped(BOUNDS.y + BOUNDS.height - BOX.height / 2).motion;
    for (let tick = 0; tick < 600 && !motion.resting; tick++) {
      motion = stepMotion(motion, 1 / 120, BOUNDS).motion;
    }
    expect(motion.resting).toBe(true);
    const narrow = { ...BOUNDS, width: 200 };
    const fitted = stepMotion(motion, 0, narrow).motion;
    expect(fitted.position.x + BOX.width / 2).toBeLessThanOrEqual(narrow.x + narrow.width + 1);
    const lower = { ...BOUNDS, height: BOUNDS.height + 100 };
    const falling = stepMotion(fitted, 1 / 120, lower).motion;
    expect(falling.resting).toBe(false);
  });
});

describe("what a hit says", () => {
  it("a tap says nothing; a bonk from 320 CSS px a second; a wham from 650", () => {
    expect(tierOf(99.9)).toBeNull();
    expect(tierOf(100)).toBe("tap");
    expect(tierOf(319.9)).toBe("tap");
    expect(tierOf(320)).toBe("bonk");
    expect(tierOf(649.9)).toBe("bonk");
    expect(tierOf(650)).toBe("wham");
    expect(tierOf(Number.NaN)).toBeNull();
  });

  it("a graze off a wall says nothing; a real hit says BONK!", () => {
    const graze = fly(throwCell({ x: 740, y: 470 }, { x: 180, y: 0 }, BOX, { x: 0, y: 0 }, 0), 120);
    expect(graze.some((state) => state.words.length > 0)).toBe(false);
    const hit = fly(throwCell({ x: 600, y: 300 }, { x: 500, y: 0 }, BOX, { x: 0, y: 0 }, 0), 120);
    const words = hit.flatMap((state) => state.words);
    expect(words[0]).toMatchObject({ tier: "bonk", surface: "right" });
  });

  it("a hard landing earns the dizzy beat, from the moment it is down", () => {
    const states = fly(dropped(150), 120);
    const end = states.at(-1)!;
    expect(end.dizzyFrom).not.toBeNull();
    const down = states.find((state) => state.dizzyFrom !== null)!;
    expect(hasLanded(down.motion)).toBe(true);
    expect(tossOf(down, ARENA, down.at).dizzyFrom).toBe(down.dizzyFrom);
  });

  it("one bonk is no dizzy beat; two are", () => {
    // Off the wall at bonk speed, landing softly.
    const once = fly(throwCell({ x: 700, y: 470 }, { x: 400, y: 0 }, BOX, { x: 0, y: 0 }, 0), 120);
    expect(once.flatMap((s) => s.words).length).toBeGreaterThan(0);
    expect(once.at(-1)!.dizzyFrom).toBeNull();
    // Off a wall and then the floor, both at bonk speed or harder.
    const corner = fly(
      throwCell({ x: 700, y: 380 }, { x: 500, y: -100 }, BOX, { x: 0, y: 0 }, 0),
      120,
    );
    const solid = corner.flatMap((s) => s.words);
    expect(new Set(solid.map((w) => w.surface)).size).toBeGreaterThanOrEqual(2);
    expect(corner.at(-1)!.dizzyFrom).not.toBeNull();
  });

  it("a catch starts a new flight: no dizzy beat from the one before, words already said finish", () => {
    const states = fly(dropped(150), 120, 1200);
    const down = states.find((state) => state.dizzyFrom !== null)!;
    const caught = grab(
      down,
      { x: down.motion.position.x, y: down.motion.position.y, at: down.at },
      ARENA,
    );
    expect(caught.dizzyFrom).toBeNull();
    expect(caught.hits).toEqual([]);
    expect(caught.words).toEqual(down.words);
    expect(tossOf(caught, ARENA, caught.at).held).toBe(true);
    // Let go, its flight starts when the let-go is handled, not at the hand's own time.
    const handled = letGo(caught, { x: 300, y: 300, at: down.at + 200 }, ARENA, down.at + 260);
    expect(handled.at).toBe(down.at + 260);
    // Set down gently, it is not dizzy.
    const gentle = letGo(
      caught,
      { x: down.motion.position.x, y: down.motion.position.y, at: down.at + 200 },
      ARENA,
    );
    const after = fly(gentle, 120);
    expect(after.at(-1)!.dizzyFrom).toBeNull();
  });
});

describe("the way home", () => {
  it("stands its bearings, then walks home at four box widths a second, facing home, and is home", () => {
    const start = throwCell({ x: 200, y: 470 }, { x: 0, y: 0 }, BOX, { x: 0, y: 0 }, 0);
    const states = fly(start, 120);
    const end = states.at(-1)!;
    expect(isHome(end, ARENA, end.at)).toBe(true);
    const from = end.setsOff!;
    const at = (t: number) => centreAt(end, ARENA, t);
    expect(at(from).x).toBeCloseTo(start.motion.position.x, 0);
    expect(at(from + 500).x - at(from).x).toBeCloseTo((HOME_PACE * BOX.width) / 2, 6);
    expect(at(from + 500).y).toBe(BOUNDS.y + BOUNDS.height - BOX.height / 2);
    const walking = tossOf(end, ARENA, from + 100);
    expect(walking.walking).toEqual({ from, toward: 1, rate: 1 });
    expect(walking.grounded).toBe(true);
    const distance = ARENA.home - start.motion.position.x;
    expect(end.at - from).toBeGreaterThanOrEqual(
      (distance / (HOME_PACE * BOX.width)) * 1000 - 1000 / 120,
    );
    // Nothing moves once it sets off but its walk: the world has stopped.
    expect(advance(end, end.at + 1000, ARENA, TIMES).motion).toBe(end.motion);
  });

  // A window is far wider than the original's chat: at its pace a Cell
  // thrown to the far side took 9 to 12 s to walk home.
  it.each([760, 1800, 3000])(
    "is home within 3.2 s from the far side of a floor %i px wide, its scoot quickened to fit",
    (width) => {
      const bounds = { ...BOUNDS, width };
      const arena: Arena = { bounds, home: bx + BOX.width / 2 };
      const far = { x: bx + width - BOX.width / 2, y: by + bh - BOX.height / 2 };
      const end = fly(
        throwCell(far, { x: 0, y: 0 }, BOX, { x: 0, y: 0 }, 0),
        120,
        20_000,
        arena,
      ).at(-1)!;
      const from = end.setsOff!;
      expect(isHome(end, arena, from + 3200)).toBe(true);
      expect(isHome(end, arena, from + 2900)).toBe(false);
      const way = end.motion.to.x - arena.home;
      const rate = tossOf(end, arena, from + 100).walking!.rate!;
      expect(rate).toBeCloseTo(way / 3 / (HOME_PACE * BOX.width), 6);
      expect(rate).toBeGreaterThan(1);
      // The walk is even all the way: a third of the way a second.
      expect(centreAt(end, arena, from).x - centreAt(end, arena, from + 1000).x).toBeCloseTo(
        way / 3,
        6,
      );
    },
  );

  it("after a dizzy beat, and once its words have faded, it gets its bearings", () => {
    const states = fly(dropped(150), 120);
    const end = states.at(-1)!;
    const lastWord = Math.max(...states.flatMap((s) => s.words).map((w) => w.at));
    expect(end.setsOff).toBeCloseTo(
      Math.max(end.dizzyFrom! + TIMES.dizzy, lastWord + TIMES.wordLife) + TIMES.bearings,
      6,
    );
    expect(tossOf(end, ARENA, end.setsOff! - 1).dizzyFrom).toBe(end.dizzyFrom);
    expect(tossOf(end, ARENA, end.setsOff!).dizzyFrom).toBeUndefined();
  });

  it("can be caught on its way home", () => {
    const states = fly(dropped(470, 200), 120);
    const end = states.at(-1)!;
    const midway = end.setsOff! + 300;
    const where = centreAt(end, ARENA, midway);
    const caught = grab(end, { x: where.x, y: where.y, at: midway }, ARENA);
    expect(caught.setsOff).toBeNull();
    expect(caught.motion.position.x).toBeCloseTo(where.x, 6);
    expect(isHome(caught, ARENA, midway + 10_000)).toBe(false);
  });
});

describe("in the hand, the press lost", () => {
  it("is set down, not thrown: it falls from where it hangs, however fast the hand went", () => {
    const up = fly(
      throwCell({ x: 300, y: 300 }, { x: 0, y: -400 }, BOX, { x: 0, y: 0 }, 0),
      120,
      150,
    );
    const air = up.at(-1)!;
    let held = grab(air, { x: 300, y: 250, at: air.at }, ARENA);
    for (let i = 1; i <= 8; i++) {
      held = hold(held, { x: 300 + i * 20, y: 250 - i * 10, at: air.at + i * 8 }, ARENA);
    }
    const thrown = letGo(held, { x: 480, y: 160, at: air.at + 72 }, ARENA);
    expect(Math.hypot(velocityOf(thrown.motion).x, velocityOf(thrown.motion).y)).toBeGreaterThan(
      TOSS_SPEED,
    );
    const set = setDown(held, air.at + 72);
    expect(set.motion.held).toBe(false);
    expect(velocityOf(set.motion)).toEqual({ x: 0, y: 0 });
    expect(set.at).toBe(air.at + 72);
    const down = fly(set, 120).at(-1)!;
    expect(down.motion.to.x).toBeCloseTo(held.motion.position.x, 0);
    // Not in the hand, nothing to set down.
    expect(setDown(air, air.at + 72)).toBe(air);
  });
});

describe("its flight proper, when Esc sends it home", () => {
  it("lasts while it is in the air or the hand, and ends when it is dizzy or down for good", () => {
    const states = fly(dropped(150), 120);
    expect(isFlying(states[0]!)).toBe(true);
    const dizzy = states.find((state) => state.dizzyFrom !== null)!;
    expect(isFlying(dizzy)).toBe(false);
    expect(isFlying(states.at(-1)!)).toBe(false);
    const plop = fly(dropped(470), 120);
    const still = plop.find((state) => state.setsOff !== null)!;
    expect(plop.slice(0, plop.indexOf(still)).every(isFlying)).toBe(true);
    expect(isFlying(still)).toBe(false);
  });
});

describe("the same flight at any frame rate", () => {
  /** Where it comes down and when it sets off home, flown on ticks `ms` apart. */
  function landing(start: Thrown, gaps: (tick: number) => number) {
    let thrown = start;
    let now = start.at;
    for (let tick = 0; tick < 5000 && thrown.setsOff === null; tick++) {
      now += gaps(tick);
      thrown = advance(thrown, now, ARENA, TIMES);
    }
    // Where its world's frame put it: what it walks home from.
    return { x: thrown.motion.to.x, y: thrown.motion.to.y, setsOff: thrown.setsOff! };
  }

  it.each(golden.flights)("$name: the same landing at 60 Hz, 120 Hz and under load", (flight) => {
    const start = thrownFrom(flight);
    const at120 = landing(start, () => 1000 / 120);
    const at60 = landing(start, () => 1000 / 60);
    // Under load: frames 4 to 40 ms apart, never the same twice running.
    const loaded = landing(start, (tick) => 4 + ((tick * 37) % 37));
    for (const other of [at60, loaded]) {
      expect(other.x).toBeCloseTo(at120.x, 6);
      expect(other.y).toBeCloseTo(at120.y, 6);
      // Its timing is the world's own frames', not the display's.
      expect(other.setsOff).toBeCloseTo(at120.setsOff, 6);
    }
  });

  it("draws the same Cell at the same moment, whatever the frames between", () => {
    const start = thrownFrom(golden.flights[0]!);
    /** Frames `50 / per` ms apart, the Cell read every 50 ms. */
    const sample = (per: number) => {
      const seen = new Map<number, ReturnType<typeof tossOf> & { x: number; y: number }>();
      let thrown = start;
      for (let tick = 1; tick <= 30 * per; tick++) {
        const now = (tick * 50) / per;
        thrown = advance(thrown, now, ARENA, TIMES);
        if (tick % per === 0) {
          const at = centreAt(thrown, ARENA, now);
          seen.set(tick / per, { ...tossOf(thrown, ARENA, now), x: at.x, y: at.y });
        }
      }
      return seen;
    };
    const fine = sample(15);
    const coarse = sample(3);
    for (const [now, toss] of coarse) {
      const other = fine.get(now)!;
      expect(other.x).toBeCloseTo(toss.x, 6);
      expect(other.y).toBeCloseTo(toss.y, 6);
      expect(other.vy).toBeCloseTo(toss.vy, 6);
      expect(other.hits?.length).toBe(toss.hits?.length);
    }
  });
});

describe("letting go of a carried chat", () => {
  const slow = { x: 60, y: 30 };
  const fast = { x: 300, y: -200 };

  it("let go slowly over a place that takes the chat, it drops there", () => {
    expect(letGoOf(true, slow, false, true)).toBe("drop");
  });

  it(`let go at ${TOSS_SPEED} CSS px a second or faster in its own chat, its Cell is thrown`, () => {
    expect(letGoOf(false, fast, false, true)).toBe("toss");
    expect(letGoOf(false, { x: TOSS_SPEED, y: 0 }, false, true)).toBe("toss");
    expect(letGoOf(false, { x: TOSS_SPEED - 0.01, y: 0 }, false, true)).toBe("home");
  });

  it("otherwise it goes home", () => {
    expect(letGoOf(false, slow, false, true)).toBe("home");
    expect(letGoOf(false, { x: Number.NaN, y: 0 }, false, true)).toBe("home");
  });

  // A Cell thrown from over another chat flew outside its own; a fast drop
  // onto a tab sprung open on the way flew the chat home.
  it("outside its own chat, a fast let-go drops the chat on a place, never throws", () => {
    expect(letGoOf(true, fast, false, false)).toBe("drop");
    expect(letGoOf(true, slow, false, false)).toBe("drop");
    expect(letGoOf(false, fast, false, false)).toBe("home");
  });

  it("with Reduce Motion nothing is thrown: it drops or goes home", () => {
    expect(letGoOf(false, fast, true, true)).toBe("home");
    expect(letGoOf(true, fast, true, false)).toBe("drop");
  });
});
