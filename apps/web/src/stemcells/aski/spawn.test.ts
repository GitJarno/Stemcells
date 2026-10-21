import * as NodeAssert from "node:assert/strict";
import { afterEach, test, vi } from "vite-plus/test";
import { theBud } from "./scenes/the-bud.ts";
import {
  budWords,
  SPAWN_WAITS,
  spawnDone,
  spawnEndsAt,
  spawnGone,
  spawnNow,
  spawnPart,
  spawnPlanned,
  spawnStart,
} from "./spawn.ts";

const RECT = { x: 40, y: 600, width: 480, height: 120 };
const CELLS = [{ title: "Fix the login bug" }, { title: "Write release notes" }];

let now = 1_000_000;
vi.spyOn(Date, "now").mockImplementation(() => now);

afterEach(() => {
  const spawn = spawnNow();
  if (spawn !== null) {
    spawnDone();
    spawnGone(spawn.id);
  }
});

test("a spawn pours from its start and buds its Cells from its plan", () => {
  spawnStart(RECT, [], "Fix login and write the notes");
  const started = spawnNow()!;
  NodeAssert.deepEqual(spawnPart(started), {
    id: "the-pour",
    startedAt: now,
    args: { text: "Fix login and write the notes" },
  });
  now += 3_000;
  spawnPlanned(CELLS);
  const planned = spawnNow()!;
  NodeAssert.deepEqual(spawnPart(planned), {
    id: "the-bud",
    startedAt: now,
    args: { words: ["login", "release"] },
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

test("the act goes once the Cells started and the bud landed them, at once when called off", () => {
  spawnStart(RECT, CELLS);
  const startedAt = now;
  NodeAssert.equal(
    spawnEndsAt(spawnNow()!),
    startedAt + SPAWN_WAITS.plan,
    "a plan that never comes",
  );
  now += 400;
  spawnDone();
  NodeAssert.equal(spawnEndsAt(spawnNow()!), now, "called off before its plan");
  spawnGone(spawnNow()!.id);

  spawnStart(RECT, CELLS);
  now += 2_000;
  spawnPlanned();
  const plannedAt = now,
    landed = plannedAt + theBud(budWords(CELLS)).end * 1000;
  NodeAssert.equal(
    spawnEndsAt(spawnNow()!),
    plannedAt + SPAWN_WAITS.start,
    "Cells that never start",
  );
  now += 100;
  spawnDone();
  NodeAssert.equal(spawnEndsAt(spawnNow()!), landed, "started before the bud landed them");
});

test("a spawn pours its Cells' titles when it came without words, and buds four at most", () => {
  spawnStart(RECT, CELLS);
  NodeAssert.equal(spawnPart(spawnNow()!).args.text, "Fix the login bug Write release notes");
  NodeAssert.deepEqual(
    budWords(
      ["Alpha task", "Beta task", "Gamma task", "Delta task", "Epsilon task"].map((title) => ({
        title,
      })),
    ),
    ["alpha", "beta", "gamma", "delta"],
  );
});
