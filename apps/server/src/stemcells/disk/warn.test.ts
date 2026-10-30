import * as NodeServices from "@effect/platform-node/NodeServices";
import { assert, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";

import { readWarnBelow, warnFile, writeWarnBelow } from "./warn.ts";

it.layer(NodeServices.layer)("the disk's warning", (it) => {
  it.effect("reads back what it kept, and nothing never chosen or that won't read", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const file = warnFile(yield* fs.makeTempDirectoryScoped({ prefix: "stemcells-warn-" }));
      assert.isNull(yield* readWarnBelow(file));
      yield* writeWarnBelow(file, 10_000_000_000);
      assert.strictEqual(yield* readWarnBelow(file), 10_000_000_000);
      yield* fs.writeFileString(file, "{");
      assert.isNull(yield* readWarnBelow(file));
      // Under 1 GB the disk is full already: never a choice, even written by hand.
      yield* fs.writeFileString(file, JSON.stringify({ warnBelow: 500_000_000 }));
      assert.isNull(yield* readWarnBelow(file));
    }).pipe(Effect.scoped),
  );
});
