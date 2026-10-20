import * as NodeAssert from "node:assert/strict";
import { test } from "vite-plus/test";
import { DISSOLVE, IDLE_BLINKS, idleBlinks } from "./acts.ts";
import { Aski, type Script } from "./aski.ts";
import { particleAt, restHomes } from "./particles.ts";
import { SCENES } from "./scenes.ts";

const tour = SCENES.tour!,
  dance = SCENES.dance!;

test("the same script and seed give the same frame", () => {
  const a = new Aski(tour),
    b = new Aski(tour);
  for (const t of [0.5, 4.1, 9.9, 13.37]) NodeAssert.deepEqual(a.frameAt(t), b.frameAt(t));
});

test("seeking lands on the frame that playing reaches", () => {
  const played = new Aski(tour);
  for (let t = 0; t <= 10; t += 1 / 30) played.frameAt(t);
  const target = 10;
  NodeAssert.deepEqual(new Aski(tour).frameAt(target).lobes, played.frameAt(target).lobes);
  // And seeking backwards replays from the start.
  const back = played.frameAt(2.5);
  NodeAssert.deepEqual(back.lobes, new Aski(tour).frameAt(2.5).lobes);
});

test("blinks are seeded", () => {
  const opens = (seed: number) => {
    const a = new Aski({ seed, cues: [] });
    return Array.from({ length: 300 }, (_, i) => a.controlsAt(i / 20).open);
  };
  NodeAssert.deepEqual(opens(3), opens(3));
  NodeAssert.notDeepEqual(opens(3), opens(4));
  NodeAssert.ok(
    opens(3).some((o) => o < 0.5),
    "it does blink",
  );
});

test("at rest Aski blinks every few seconds, a double now and then, never in a flutter, and at the same moments wherever it shows", () => {
  const day = 1_760_000_000;
  const blinks = idleBlinks(day, day + 600, 1);
  NodeAssert.deepEqual(blinks, idleBlinks(day, day + 600, 1));
  const gaps = blinks.slice(1).map((at, i) => at - blinks[i]!);
  const doubles = gaps.filter((gap) => Math.abs(gap - IDLE_BLINKS.double) < 1e-3).length;
  NodeAssert.ok(
    gaps.every((gap) => Math.abs(gap - IDLE_BLINKS.double) < 1e-3 || gap >= 3),
    "no two blinks crowd",
  );
  NodeAssert.ok(
    blinks.length - doubles >= 130 && blinks.length - doubles <= 140,
    "one blink to a slot",
  );
  NodeAssert.ok(doubles > 10 && doubles < 50, "a double now and then");
});

test("a walk ends where it was sent, facing the way it went", () => {
  const s: Script = { seed: 1, cues: [{ at: 0, act: "walk", args: { to: -150 } }] };
  const a = new Aski(s),
    end = a.controlsAt(a.length);
  NodeAssert.equal(end.x, -150);
  NodeAssert.equal(end.dir, -1);
  NodeAssert.ok(a.frameAt(a.length).facing < -0.99, "and the eyes have turned to match");
});

test("the springs stay calm through a whole dance", () => {
  const a = new Aski(dance);
  for (let t = 0; t < a.length; t += 0.25) {
    const f = a.frameAt(t);
    for (const v of f.lobes) NodeAssert.ok(Number.isFinite(v) && Math.abs(v) < 600, `t=${t}`);
  }
  NodeAssert.equal(
    a.frameAt(a.length).limbs,
    null,
    "the limbs are back in the lobes when it stops",
  );
});

test("a settled dissolve is exactly the ASCII grid", () => {
  for (const h of restHomes()) NodeAssert.deepEqual(particleAt(h, 7, 3, 1), [h.x, h.y]);
  const a = new Aski(SCENES.dissolve!),
    c = a.controlsAt(0.8 + (DISSOLVE.settle[1] + DISSOLVE.fill[0]) / 2);
  NodeAssert.equal(c.settle, 1);
  NodeAssert.equal(c.solid, 0);
});

test("an unknown act is refused when the script is read", () => {
  NodeAssert.throws(
    () => new Aski({ seed: 1, cues: [{ at: 0, act: "fly" as never }] }),
    /Unknown act/,
  );
});
