import * as NodeServices from "@effect/platform-node/NodeServices";
import { assert, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Path from "effect/Path";

import { appendPlan, clearPlans, dayFile, HISTORY_DAYS, staleFiles } from "./history.ts";

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.parse("2026-10-21T12:00:00.000Z");

it("files a plan under its day, and keeps 30 days", () => {
  assert.strictEqual(dayFile(NOW), "2026-10-21.jsonl");
  const names = [
    dayFile(NOW - (HISTORY_DAYS + 1) * DAY),
    dayFile(NOW - HISTORY_DAYS * DAY),
    dayFile(NOW),
    "notes.txt",
  ];
  assert.deepStrictEqual(staleFiles(names, NOW), ["2026-09-20.jsonl"]);
});

it.layer(NodeServices.layer)("the plan history on disk", (it) => {
  it.effect("adds one line per plan, lets the old days go, and clears", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fs.makeTempDirectoryScoped({ prefix: "stemcells-plans-" });
      const folder = path.join(root, "plans");
      yield* appendPlan(folder, { words: "old" }, NOW - 40 * DAY);
      yield* appendPlan(folder, { words: "first" }, NOW);
      yield* appendPlan(folder, { words: "second", outcome: "started" }, NOW + 1000);
      assert.deepStrictEqual(yield* fs.readDirectory(folder), ["2026-10-21.jsonl"]);
      const lines = (yield* fs.readFileString(path.join(folder, "2026-10-21.jsonl")))
        .trim()
        .split("\n")
        .map((line) => JSON.parse(line) as Record<string, unknown>);
      assert.deepStrictEqual(lines, [
        { at: "2026-10-21T12:00:00.000Z", words: "first" },
        { at: "2026-10-21T12:00:01.000Z", words: "second", outcome: "started" },
      ]);
      yield* clearPlans(folder);
      assert.isFalse(yield* fs.exists(folder));
      yield* clearPlans(folder);
    }).pipe(Effect.scoped),
  );
});
