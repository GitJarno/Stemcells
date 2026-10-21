import * as NodeAssert from "node:assert/strict";
import { test } from "vite-plus/test";

import { backAfter, CLICKS, clicked, nightOf, SILENCE } from "./triggers.ts";

test("seven clicks within three seconds earn the bits, and start the count again", () => {
  let clicks: number[] = [];
  for (let n = 0; n < CLICKS.count - 1; n++) {
    const next = clicked(clicks, n * 300);
    NodeAssert.ok(!next.seven, `click ${n + 1}`);
    clicks = next.clicks;
  }
  const seventh = clicked(clicks, 1_900);
  NodeAssert.ok(seventh.seven);
  NodeAssert.deepEqual(seventh.clicks, [], "the next seven start from none");
});

test("slow clicks never add up to seven", () => {
  let clicks: number[] = [];
  for (let n = 0; n < 20; n++) {
    const next = clicked(clicks, n * 600);
    NodeAssert.ok(!next.seven, `click ${n + 1}`);
    clicks = next.clicks;
  }
});

test("back is said after a long enough silence in which no run was lost", () => {
  NodeAssert.ok(backAfter(0, SILENCE, []));
  NodeAssert.ok(!backAfter(0, SILENCE - 1, []), "a blip is not a return");
  NodeAssert.ok(!backAfter(0, 60_000, [{ at: 20_000 }]), "a run lost in the silence");
  NodeAssert.ok(
    backAfter(10_000, 60_000, [{ at: 5_000 }]),
    "a run lost before it is not this silence's",
  );
});

test("the night runs from 23:00 to 05:00 and is named by the evening it began", () => {
  const at = (day: number, hour: number, minute = 0) => new Date(2026, 9, day, hour, minute);
  NodeAssert.equal(nightOf(at(21, 22, 59)), null);
  NodeAssert.equal(nightOf(at(21, 23)), "2026-10-21");
  NodeAssert.equal(
    nightOf(at(22, 2, 30)),
    "2026-10-21",
    "after midnight it is still the 21st's night",
  );
  NodeAssert.equal(nightOf(at(22, 4, 59)), "2026-10-21");
  NodeAssert.equal(nightOf(at(22, 5)), null);
  NodeAssert.equal(nightOf(new Date(2026, 10, 1, 1)), "2026-10-31", "across a month's end");
});
