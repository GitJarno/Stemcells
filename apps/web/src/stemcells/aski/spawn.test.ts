import * as NodeAssert from "node:assert/strict";
import { afterEach, test, vi } from "vite-plus/test";
import { thrown } from "./scenes/the-throw.ts";
import {
  SPAWN_WAITS,
  spawnDone,
  spawnEndsAt,
  spawnGone,
  spawnNow,
  spawnPart,
  spawnPlanned,
  spawnStart,
  throwLooks,
} from "./spawn.ts";

const RECT = { x: 400, y: 300, width: 480, height: 120 };
const TIMES = { lookIn: 0.94, turn: 1.6, stagger: 0.09, travel: 0.481, flick: 0.12 };
const CELLS = [{ title: "Sol 6.1 · Harbor" }, { title: "Sol 6.1 · Pier" }];

let now = 1_000_000;
vi.spyOn(Date, "now").mockImplementation(() => now);

afterEach(() => {
  const spawn = spawnNow();
  if (spawn !== null) {
    spawnDone();
    spawnGone(spawn.id);
  }
});

test("Aski waits from the start and throws once the plan is in, a stream a Cell", () => {
  spawnStart(RECT, CELLS);
  NodeAssert.deepEqual(spawnPart(spawnNow()!, TIMES), {
    id: "the-wait",
    startedAt: now,
    args: { times: { lookIn: 0.94, turn: 1.6 } },
  });
  now += 3_000;
  spawnPlanned();
  NodeAssert.deepEqual(spawnPart(spawnNow()!, TIMES), {
    id: "the-throw",
    startedAt: now,
    args: {
      n: 2,
      looks: [
        [0, 0],
        [0, 0],
      ],
      times: { stagger: 0.09, travel: 0.481, flick: 0.12 },
    },
  });
});

test("calls out of order, or again, change nothing", () => {
  spawnPlanned(CELLS);
  spawnDone();
  NodeAssert.equal(spawnNow(), null, "nothing to plan or finish");
  spawnStart(RECT, CELLS);
  const first = spawnNow()!;
  spawnStart({ ...RECT, x: 0 }, []);
  NodeAssert.equal(spawnNow(), first, "one spawn at a time");
  spawnPlanned();
  const planned = spawnNow()!;
  now += 500;
  spawnPlanned([{ title: "Something else" }]);
  NodeAssert.equal(spawnNow(), planned, "planned once");
  spawnDone();
  spawnStart(RECT, CELLS);
  NodeAssert.equal(spawnNow()!.id, first.id + 1, "a finished one makes way for the next");
});

test("Aski goes once the streams have landed and it threw them all, at once when called off", () => {
  spawnStart(RECT, CELLS);
  const startedAt = now;
  NodeAssert.equal(spawnEndsAt(spawnNow()!, TIMES), startedAt + SPAWN_WAITS.plan, "no plan comes");
  now += 400;
  spawnDone();
  NodeAssert.equal(spawnEndsAt(spawnNow()!, TIMES), now, "called off before its plan");
  spawnGone(spawnNow()!.id);

  spawnStart(RECT, []);
  now += 2_000;
  const four = [1, 2, 3, 4].map((k) => ({ title: `Cell ${k}` }));
  spawnPlanned(four);
  const plannedAt = now;
  NodeAssert.equal(
    spawnEndsAt(spawnNow()!, TIMES),
    plannedAt + SPAWN_WAITS.start,
    "streams that never land",
  );
  now += 100;
  spawnDone();
  NodeAssert.equal(
    spawnEndsAt(spawnNow()!, TIMES),
    plannedAt + thrown(4, TIMES) * 1000,
    "landed before Aski threw the last",
  );
});

test("Aski's eyes go to each pane as its stream leaves, in the order the composer sends them", () => {
  const right = { x: 1200, y: 300, width: 200, height: 40 },
    below = { x: 400, y: 500, width: 480, height: 40 };
  spawnStart(RECT, []);
  spawnPlanned([
    { title: "Near, below", to: below },
    { title: "Far, right", to: right },
    { title: "No pane yet" },
  ]);
  const [first, second, third] = throwLooks(spawnNow()!);
  NodeAssert.ok(first![1] > 0 && Math.abs(first![0]) < 1e-9, "the first, below: eyes down");
  NodeAssert.ok(second![0] > 0 && second![1] < 0, "then the next, to the right and up");
  NodeAssert.deepEqual(third, [0, 0], "and straight ahead for one without a pane");
});
