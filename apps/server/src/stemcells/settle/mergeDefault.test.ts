import * as NodeServices from "@effect/platform-node/NodeServices";
import { assert, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";

import * as ServerConfig from "../../config.ts";
import * as ServerSettings from "../../serverSettings.ts";
import * as UpstreamSettle from "../upstream/settle.ts";
import { applyMergeDefault } from "./mergeDefault.ts";

/** A server on upstream's defaults, its state folder fresh for each test. */
const layerServer = () =>
  Layer.mergeAll(
    Layer.fresh(ServerConfig.layerTest(process.cwd(), { prefix: "stemcells-settle-" })),
    Layer.fresh(ServerSettings.layerTest()),
  );

it.layer(NodeServices.layer)("settling on merge, on start", (it) => {
  it.effect("is turned off on a fresh server, and recorded as applied", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      assert.isTrue(yield* UpstreamSettle.settlesOnMerge);

      yield* applyMergeDefault();
      assert.isFalse(yield* UpstreamSettle.settlesOnMerge);
      const applied = JSON.parse(
        yield* fs.readFileString(yield* UpstreamSettle.appliedDefaultsPath),
      );
      assert.isString(applied.sidebarAutoSettleOnMerge);
    }).pipe(Effect.provide(layerServer())),
  );

  it.effect("stays on once the person turns it back on", () =>
    Effect.gen(function* () {
      yield* applyMergeDefault();
      yield* UpstreamSettle.setSettleOnMerge(true);

      yield* applyMergeDefault();
      assert.isTrue(yield* UpstreamSettle.settlesOnMerge);
    }).pipe(Effect.provide(layerServer())),
  );
});
