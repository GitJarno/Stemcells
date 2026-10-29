import * as NodeServices from "@effect/platform-node/NodeServices";
import { assert, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";

import * as ServerConfig from "../../config.ts";
import * as ServerSettings from "../../serverSettings.ts";
import * as UpstreamDefaults from "../upstream/defaults.ts";
import { applyDefaults } from "./defaults.ts";

/** A server on upstream's defaults, its state folder fresh for each test. */
const layerServer = () =>
  Layer.mergeAll(
    Layer.fresh(ServerConfig.layerTest(process.cwd(), { prefix: "stemcells-defaults-" })),
    Layer.fresh(ServerSettings.layerTest()),
  );

it.layer(NodeServices.layer)("Stemcells' defaults, on start", (it) => {
  it.effect("turn settling on merge off and auto-resume on, recorded as applied", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      assert.isTrue(yield* UpstreamDefaults.readSwitch("sidebarAutoSettleOnMerge"));
      assert.isFalse(yield* UpstreamDefaults.readSwitch("autoResumeLimitedThreads"));

      yield* applyDefaults();
      assert.isFalse(yield* UpstreamDefaults.readSwitch("sidebarAutoSettleOnMerge"));
      assert.isTrue(yield* UpstreamDefaults.readSwitch("autoResumeLimitedThreads"));
      const applied = JSON.parse(
        yield* fs.readFileString(yield* UpstreamDefaults.appliedDefaultsPath),
      );
      assert.isString(applied.sidebarAutoSettleOnMerge);
      assert.isString(applied.autoResumeLimitedThreads);
    }).pipe(Effect.provide(layerServer())),
  );

  it.effect("keep what the person turns back", () =>
    Effect.gen(function* () {
      yield* applyDefaults();
      yield* UpstreamDefaults.setSwitch("sidebarAutoSettleOnMerge", true);
      yield* UpstreamDefaults.setSwitch("autoResumeLimitedThreads", false);

      yield* applyDefaults();
      assert.isTrue(yield* UpstreamDefaults.readSwitch("sidebarAutoSettleOnMerge"));
      assert.isFalse(yield* UpstreamDefaults.readSwitch("autoResumeLimitedThreads"));
    }).pipe(Effect.provide(layerServer())),
  );

  it.effect("apply a default added later on a server that applied the others", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const file = yield* UpstreamDefaults.appliedDefaultsPath;
      yield* applyDefaults();
      yield* fs.writeFileString(file, JSON.stringify({ sidebarAutoSettleOnMerge: "earlier" }));
      yield* UpstreamDefaults.setSwitch("sidebarAutoSettleOnMerge", true);
      yield* UpstreamDefaults.setSwitch("autoResumeLimitedThreads", false);

      yield* applyDefaults();
      assert.isTrue(yield* UpstreamDefaults.readSwitch("sidebarAutoSettleOnMerge"));
      assert.isTrue(yield* UpstreamDefaults.readSwitch("autoResumeLimitedThreads"));
    }).pipe(Effect.provide(layerServer())),
  );
});
