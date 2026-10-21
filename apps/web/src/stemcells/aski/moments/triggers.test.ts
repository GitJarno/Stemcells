import * as NodeAssert from "node:assert/strict";
import { test } from "vite-plus/test";

import {
  backAfter,
  type ChatSeen,
  CLEAR,
  CLICKS,
  clicked,
  HAUL,
  hauled,
  landedWhileOut,
  MANY,
  nightOf,
  NONE_WAITING,
  OUT_FOR,
  type RunSeen,
  SILENCE,
  startedBy,
  type Waiting,
  waited,
  type Watching,
} from "./triggers.ts";

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

const MINUTE = 60_000;
const run = (id: string, over: Partial<RunSeen> = {}): RunSeen => ({
  id,
  ended: null,
  requestedAt: null,
  startedAt: null,
  endedAt: null,
  ...over,
});
const chat = (key: string, over: Partial<ChatSeen> = {}): ChatSeen => ({
  key,
  standing: "done",
  run: null,
  createdAt: 0,
  launched: false,
  ...over,
});

test("the news counts the Cells that landed while the person was out an hour or more, and no others", () => {
  const back = { from: 10 * MINUTE, to: 10 * MINUTE + OUT_FOR };
  const chats = [
    chat("a", { run: run("1", { ended: "landed", endedAt: 20 * MINUTE }) }),
    chat("b", { run: run("2", { ended: "landed", endedAt: back.to }) }),
    chat("c", { run: run("3", { ended: "landed", endedAt: 5 * MINUTE }) }),
    chat("d", { run: run("4", { ended: "landed", endedAt: back.to + 1 }) }),
    chat("e", { run: run("5", { ended: "dropped", endedAt: 20 * MINUTE }) }),
    chat("f", { run: run("6", { startedAt: 20 * MINUTE }) }),
  ];
  NodeAssert.equal(landedWhileOut(back, chats), 2);
  NodeAssert.equal(landedWhileOut({ from: back.from, to: back.from + OUT_FOR - 1 }, chats), 0);
  NodeAssert.equal(landedWhileOut(undefined, chats), 0);
});

test("many counts the Cells Aski's run launched while it ran, not the person's or earlier ones", () => {
  const aski = run("aski", { requestedAt: 100, ended: "landed", endedAt: 200 });
  const launched = (key: string, at: number) => chat(key, { launched: true, createdAt: at });
  const chats = [
    ...["a", "b", "c", "d", "e"].map((k, n) => launched(k, 110 + n)),
    launched("before", 99),
    launched("after", 201),
    chat("mine", { createdAt: 150 }),
  ];
  NodeAssert.deepEqual(
    startedBy(aski, chats, 300).map((c) => c.key),
    ["a", "b", "c", "d", "e"],
  );
  NodeAssert.equal(startedBy(aski, chats, 300).length, MANY);
  NodeAssert.equal(startedBy(run("x", { endedAt: 200 }), chats, 300).length, 0, "never asked for");
});

test("clear: three or more asks answered down to none within half an hour of the most", () => {
  const see = (counts: readonly [number, number][]): (number | null)[] => {
    let w: Waiting = NONE_WAITING;
    return counts.map(([count, at]) => {
      const next = waited(w, count, at);
      w = next.waiting;
      return next.cleared;
    });
  };
  NodeAssert.deepEqual(
    see([
      [1, 0],
      [3, MINUTE],
      [2, 2 * MINUTE],
      [0, 20 * MINUTE],
    ]),
    [null, null, null, 3],
  );
  NodeAssert.deepEqual(
    see([
      [2, 0],
      [0, MINUTE],
    ]),
    [null, null],
    "two is not many",
  );
  NodeAssert.deepEqual(
    see([
      [3, 0],
      [0, CLEAR.within + 1],
    ]),
    [null, null],
    "answered too slowly to call it cleared",
  );
  NodeAssert.deepEqual(see([[0, 0]]), [null], "nothing was waiting");
});

test("a haul is a run of an hour or more, watched from its start, that landed without asking", () => {
  const opened = 0;
  const step = (watching: Watching, chats: ChatSeen[]) => hauled(watching, chats, opened);
  const going = (asks: boolean) =>
    chat("a", {
      standing: asks ? "needsYou" : "working",
      run: run("r", { requestedAt: 10, startedAt: 20 }),
    });
  const landed = (after: number) =>
    chat("a", {
      run: run("r", { requestedAt: 10, startedAt: 20, ended: "landed", endedAt: 20 + after }),
    });

  let w = step(new Map(), [going(false)]).watching;
  NodeAssert.deepEqual(step(w, [landed(2 * HAUL + 1)]).hauls, [{ key: "a", hours: 2 }]);
  NodeAssert.deepEqual(step(w, [landed(HAUL - 1)]).hauls, [], "under an hour");

  w = step(step(new Map(), [going(false)]).watching, [going(true)]).watching;
  NodeAssert.deepEqual(step(w, [landed(HAUL)]).hauls, [], "it asked the person once");

  const late = hauled(new Map(), [going(false)], 15).watching;
  NodeAssert.deepEqual(
    hauled(late, [landed(HAUL)], 15).hauls,
    [],
    "the page opened after it began",
  );
  NodeAssert.deepEqual(step(new Map(), [landed(HAUL)]).hauls, [], "never seen running");
});
