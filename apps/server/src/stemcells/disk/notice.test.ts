import * as NodeServices from "@effect/platform-node/NodeServices";
import { assert, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";

import { keptHiddenAt, noticeFile, readHiddenAt, writeHiddenAt } from "./notice.ts";

const GB = 1e9;

it.layer(NodeServices.layer)("the disk notice's hide", (it) => {
  it.effect("reads back what it kept, nothing once shown again, and nothing that won't read", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const file = noticeFile(yield* fs.makeTempDirectoryScoped({ prefix: "stemcells-notice-" }));
      assert.isNull(yield* readHiddenAt(file));
      yield* writeHiddenAt(file, 8 * GB);
      assert.strictEqual(yield* readHiddenAt(file), 8 * GB);
      yield* writeHiddenAt(file, null);
      assert.isNull(yield* readHiddenAt(file));
      yield* writeHiddenAt(file, null);
      yield* fs.writeFileString(file, JSON.stringify({ hiddenAt: -1 }));
      assert.isNull(yield* readHiddenAt(file));
    }).pipe(Effect.scoped),
  );

  it.effect("stands while the disk is low, and is forgotten once it is calm or has news", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const file = noticeFile(yield* fs.makeTempDirectoryScoped({ prefix: "stemcells-notice-" }));
      yield* writeHiddenAt(file, 8 * GB);
      assert.strictEqual(yield* keptHiddenAt(file, { free: 6 * GB, warnBelow: null }), 8 * GB);
      // Calm under the person's own threshold: the next low disk shows the notice.
      assert.isNull(yield* keptHiddenAt(file, { free: 12 * GB, warnBelow: 10 * GB }));
      assert.isNull(yield* readHiddenAt(file));
      assert.isNull(yield* keptHiddenAt(file, { free: 6 * GB, warnBelow: null }));

      yield* writeHiddenAt(file, 8 * GB);
      assert.isNull(yield* keptHiddenAt(file, { free: 3 * GB, warnBelow: null }));
      assert.isNull(yield* readHiddenAt(file));
    }).pipe(Effect.scoped),
  );
});
