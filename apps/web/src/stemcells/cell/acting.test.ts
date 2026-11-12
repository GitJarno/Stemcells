import * as NodeAssert from "node:assert/strict";
import { test } from "vite-plus/test";
import {
  actFor,
  castFor,
  performing,
  poke,
  pokeCue,
  resetActing,
  stand,
  standingOf,
} from "./acting.ts";
import { ACTS, REST, SCENES } from "./kit.ts";
import { NAMES } from "./name.ts";

const lengthOf = (key: string) => SCENES.get(key)!.frames.length / 12;

test("a flurry of pokes climbs: an answer, a bigger one, a spin, then dazed and deaf to more", () => {
  resetActing();
  stand("a", "awake", false);
  const first = poke("a", 100)!;
  NodeAssert.ok(castFor("poke/rest", "a").includes(first.key));
  const second = poke("a", 100.4)!;
  NodeAssert.ok(castFor("poke/rest/2", "a").includes(second.key));
  const third = poke("a", 100.8)!;
  const fourth = poke("a", 101.2)!;
  NodeAssert.ok(castFor("poke/rest/3", "a").includes(third.key));
  NodeAssert.ok(castFor("poke/rest/3", "a").includes(fourth.key));
  const dazed = poke("a", 101.6)!;
  NodeAssert.equal(dazed.key, "act/dazed");
  NodeAssert.equal(poke("a", dazed.since + 1), dazed, "a dazed Cell hears nothing");
  NodeAssert.equal(performing("a", dazed.since + 1, "rest"), dazed);
  const after = poke("a", dazed.until + 5)!;
  NodeAssert.ok(castFor("poke/rest", "a").includes(after.key), "the flurry over, it starts again");
});

test("a Cell in the air lands before the next act starts", () => {
  resetActing();
  const leaves = (key: string | undefined) =>
    SCENES.get(key ?? "")?.frames.some((frame) => frame.pose.base < REST.base) === true;
  // A Cell whose second answer leaves the ground: which act that is, is its temperament's.
  const name = NAMES.find((one) => leaves(actFor("poke/rest/2", one, 0)))!;
  stand(name, "awake", false);
  poke(name, 100);
  const jump = poke(name, 100.2)!;
  const frames = SCENES.get(jump.key)!.frames;
  const airborne = frames.findIndex((frame) => frame.pose.base < REST.base);
  const midAir = jump.since + (airborne + 0.5) / 12;
  const next = poke(name, midAir)!;
  NodeAssert.ok(next.since > midAir, "it waits for the landing");
  NodeAssert.equal(performing(name, midAir, "rest"), jump, "and plays the jump out till then");
  const landed = frames[Math.trunc((next.since - jump.since) * 12)]!;
  NodeAssert.equal(landed.pose.base, REST.base);
  NodeAssert.equal(performing(name, next.since, "rest"), next);
});

test("a poke is answered in the state the Cell is in, once, and dropped when the state turns", () => {
  resetActing();
  for (const [mood, working, cue] of [
    ["awake", true, "poke/work"],
    ["pleased", false, "poke/landed"],
  ] as const) {
    stand("b", mood, working);
    const answer = poke("b", 50)!;
    NodeAssert.ok(castFor(cue, "b").includes(answer.key), cue);
    NodeAssert.equal(poke("b", 50.3), answer, "a second poke lets the answer play out");
    const standing = standingOf(mood, working);
    NodeAssert.equal(performing("b", 50.3, standing), answer);
    NodeAssert.equal(performing("b", 50.3, "ask"), undefined, "it asks now: the act is gone");
    NodeAssert.equal(performing("b", 50 + lengthOf(answer.key), standing), undefined);
    resetActing();
  }
  NodeAssert.equal(pokeCue("ask", 7), "poke/ask", "only a resting Cell's pokes climb");
});

test("each Cell goes through a cue's cast from a place of its own, never the same act twice running", () => {
  const cue = [...new Set(["poke/rest", "poke/work"])].find((c) => castFor(c, "x").length > 1)!;
  const starts = new Set(NAMES.map((name) => actFor(cue, name, 0)));
  NodeAssert.ok(starts.size > 1, "two Cells start in different places");
  for (const name of NAMES.slice(0, 20)) {
    if (castFor(cue, name).length < 2) continue;
    for (let turn = 0; turn < 40; turn++)
      NodeAssert.notEqual(actFor(cue, name, turn), actFor(cue, name, turn + 1), `${name} ${turn}`);
  }
});

test("every act the kit casts for a poke is one a deaf act's flag and length can be read from", () => {
  NodeAssert.equal(ACTS.get("dazed")?.deaf, true);
  NodeAssert.ok([...ACTS.values()].every((act) => act.problems.length === 0));
});
