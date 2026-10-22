// @effect-diagnostics nodeBuiltinImport:off - reads the tokens' sheet, as the page's style does.
import * as NodeFS from "node:fs";

import { describe, expect, it } from "vite-plus/test";

import { BOX } from "./look.ts";
import { onBeat, packLook, pastDetail, probeStill, sceneOf } from "./scene.ts";
import { dizzyStars, type Hit, type Toss, tossFrame, tossPose, WALK, wordCentre } from "./toss.ts";

const still: Toss = { held: false, vx: 0, vy: 0, grounded: true };
const flying: Toss = { ...still, grounded: false };
const T0 = 10_000;
const hit = (surface: Hit["surface"], speed: number, along = 0): Hit => ({
  surface,
  speed,
  along,
  at: T0,
});
/** The pose `ms` after a hit, the body otherwise still in the air. */
const after = (h: Hit, ms: number, toss: Toss = flying) =>
  tossPose({ ...toss, hits: [h] }, T0 + ms);
const over = (from: number, to: number, pick: (ms: number) => number) =>
  Array.from({ length: to - from + 1 }, (_, i) => pick(from + i));

describe("a thrown Cell, as the original's soft Cell flies", () => {
  it("hangs from the hand stretched, braced with an o", () => {
    const pose = tossPose({ ...still, held: true }, T0);
    expect(pose.sy).toBeCloseTo(1.08, 1);
    expect([pose.eyes, pose.mouth]).toEqual(["squeeze", "open"]);
  });

  it("smiles going up, braces with an o coming down, stretched along its speed; calm at the top", () => {
    const rising = tossPose({ ...flying, vy: -400 }, T0);
    const falling = tossPose({ ...flying, vy: 500 }, T0);
    const top = tossPose(flying, T0);
    expect([rising.eyes, rising.mouth]).toEqual(["happy", "smile"]);
    expect([falling.eyes, falling.mouth]).toEqual(["squeeze", "open"]);
    expect([top.eyes, top.mouth]).toEqual(["calm", "none"]);
    expect(rising.sy).toBeGreaterThan(1);
    expect(falling.sy).toBeGreaterThan(rising.sy);
    expect(top.sy).toBe(1);
  });

  it("leans into its flight with its hat trailing", () => {
    const pose = tossPose({ ...flying, vx: 500 }, T0);
    expect(pose.lean).toBeGreaterThan(0);
    expect(pose.hatDX).toBeLessThan(0);
  });

  it("flattens against a wall it hits, throws its crown off it, braces, then settles", () => {
    const bonk = hit("left", 650);
    const soon = after(bonk, 30);
    expect(soon.sy).toBeGreaterThan(1);
    expect(soon.sx).toBeLessThan(1);
    expect(soon.lean).toBeGreaterThan(0);
    expect(soon.eyes).toBe("squeeze");
    expect(Math.min(...over(0, 200, (ms) => after(hit("right", 650), ms).lean))).toBeLessThan(0);
    const later = after(bonk, 1500);
    expect([later.sy, later.lean, later.hatDX, later.eyes]).toEqual([1, 0, 0, "calm"]);
  });

  it("is pressed down by the chat's top", () => {
    expect(Math.min(...over(0, 100, (ms) => after(hit("ceiling", 500), ms).sy))).toBeLessThan(1);
  });

  it("pancakes as it lands and rebounds; a hard landing hurts", () => {
    const landing = hit("floor", 600);
    expect(Math.min(...over(0, 100, (ms) => after(landing, ms, still).sy))).toBeLessThan(0.9);
    expect(Math.max(...over(100, 250, (ms) => after(landing, ms, still).sy))).toBeGreaterThan(1);
    expect(after(landing, 20, still).eyes).toBe("squeeze");
    expect(after(hit("floor", 40), 20, still).eyes).toBe("calm");
  });

  it("grins as it slides, its crown tipped forward over its braking", () => {
    const pose = tossPose({ ...still, vx: 200 }, T0);
    expect([pose.eyes, pose.mouth]).toEqual(["happy", "grin"]);
    expect(pose.lean).toBeGreaterThan(0);
  });

  it("rolls its face round from an off-centre throw, the back of its head past a quarter turn", () => {
    expect(tossPose({ ...flying, roll: 0.5 }, T0).face).toBe(5);
    expect(tossPose({ ...flying, roll: Math.PI }, T0).eyes).toBe("none");
  });

  it("is dizzy over everything else through its dizzy beat", () => {
    const pose = tossPose({ ...flying, held: true, dizzyFrom: T0 }, T0);
    expect([pose.eyes, pose.mouth]).toEqual(["dizzy", "wavy"]);
  });

  it("holds its body still under Reduce Motion, its face kept", () => {
    const pose = tossPose(
      { ...flying, vx: 500, vy: 500, hits: [hit("left", 900)] },
      T0 + 20,
      2,
      true,
    );
    expect([pose.sy, pose.sx, pose.lean, pose.hatDX]).toEqual([1, 1, 0, 0]);
    expect(pose.eyes).toBe("squeeze");
  });

  it("keeps its body on the canvas through the hardest throw", () => {
    // A hard hit can throw a hat past the canvas's side for a moment, as
    // the original's narrower canvas did; the body itself stays on it.
    const fastest = 1100;
    const states: Toss[] = [
      { ...flying, vx: fastest, vy: fastest },
      { ...flying, vx: -fastest, vy: -fastest },
      { ...still, vx: fastest },
      { ...still, held: true },
    ];
    const hits = [
      hit("left", fastest),
      hit("right", fastest),
      hit("ceiling", fastest),
      hit("floor", fastest, fastest),
    ];
    const bare = packLook([]);
    for (const state of states)
      for (const h of hits)
        for (let ms = 0; ms <= 400; ms += 10) {
          const pose = after(h, ms, state);
          const hero = probeStill(bare, pose, false);
          expect(hero.effects - pastDetail(hero.bare), `${h.surface} ${ms} ms`).toBe(0);
          expect(probeStill(bare, pose, true).effects, `${h.surface} ${ms} ms`).toBe(0);
        }
  });

  it("walks home in its scoot, facing home", () => {
    const look = packLook([]);
    const walk = sceneOf(look, WALK)!;
    const step = 1000 / onBeat(walk.fps);
    const left = tossFrame(look, { ...still, walking: { from: T0, toward: -1 } }, T0 + step * 2);
    const right = tossFrame(look, { ...still, walking: { from: T0, toward: 1 } }, T0 + step * 2);
    expect(left).toBe(walk.mini[2]);
    expect(right.detail).toEqual(walk.mini[2]!.detail.map((row) => [...row].toReversed().join("")));
  });

  it("quickens its scoot's beat with its pace, so a quicker walk takes the same steps", () => {
    const look = packLook([]);
    const walk = sceneOf(look, WALK)!;
    const step = 1000 / onBeat(walk.fps);
    const quick = { ...still, walking: { from: T0, toward: -1, rate: 3 } } as const;
    // Three times its pace: each frame of the scoot a third as long.
    expect(tossFrame(look, quick, T0 + (3.5 * step) / 3)).toBe(walk.mini[3]);
    expect(tossFrame(look, quick, T0 + (4.5 * step) / 3)).toBe(walk.mini[4]);
  });

  it("circles three stars round its head, the near ones larger and brighter, gone by the beat's end", () => {
    const stars = dizzyStars(100, 1150);
    expect(stars).toHaveLength(3);
    for (const star of stars) expect(star.y).toBeLessThan(0);
    const [near, far] = stars.toSorted((a, b) => b.r - a.r);
    expect(near!.alpha).toBeGreaterThan(far!.alpha);
    expect(dizzyStars(1150, 1150).every((star) => star.alpha === 0)).toBe(true);
  });

  it("says the word in from the wall it hit, clear of the body, inside the chat", () => {
    const bounds = { x: 0, y: 0, width: 400, height: 300 };
    const extent = { width: 20, height: 6 };
    const body = { x: 0, y: 120, width: BOX.width * 2, height: BOX.height * 2 };
    const word = wordCentre("left", extent, body, bounds, { x: 200, y: 50 });
    expect(word.x).toBe(extent.width + 2);
    expect(word.y).toBeLessThan(body.y);
    const rising = wordCentre("left", extent, body, bounds, { x: 200, y: -50 });
    expect(rising.y).toBeGreaterThan(body.y + body.height);
    const ceiling = wordCentre("ceiling", extent, { ...body, x: 180, y: 0 }, bounds, {
      x: 300,
      y: 0,
    });
    expect(ceiling.x).toBeLessThan(180);
    const cornered = wordCentre("floor", extent, { ...body, x: 0, y: 272 }, bounds);
    expect(cornered.x - extent.width).toBeGreaterThanOrEqual(body.width);
    expect(cornered.y + extent.height).toBeLessThanOrEqual(bounds.height);
  });

  it("times the word and the dizzy beat on tokens", () => {
    const css = NodeFS.readFileSync(new URL("../tokens/stemcells.css", import.meta.url), "utf8");
    const token = (name: string) =>
      Number(new RegExp(`--sc-timing-${name}:\\s*([\\d.]+)ms`).exec(css)?.[1]);
    expect([token("knock-stand"), token("dizzy"), token("bearings")]).toEqual([250, 1150, 350]);
  });
});
