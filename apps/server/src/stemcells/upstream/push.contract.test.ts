import * as NodeServices from "@effect/platform-node/NodeServices";
import { EnvironmentId } from "@t3tools/contracts";
import { assert, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import * as ServerSecretStore from "../../auth/ServerSecretStore.ts";
import * as ServerConfig from "../../config.ts";
import * as ServerEnvironment from "../../environment/ServerEnvironment.ts";
import * as UpstreamDisk from "./disk.ts";
import { makePushSource } from "./push.ts";

// Contract: the person's APNs key round-trips through upstream's secret
// store and is gone once forgotten, and the phones survive a restart in the
// app's state folder.

const layerServer = ServerSecretStore.layer.pipe(
  Layer.provideMerge(ServerConfig.layerTest(process.cwd(), { prefix: "stemcells-push-" })),
  Layer.provideMerge(
    Layer.succeed(ServerEnvironment.ServerEnvironment, {
      getEnvironmentId: Effect.succeed(EnvironmentId.make("env-1")),
      getDescriptor: Effect.die("unused"),
    }),
  ),
);

const source = makePushSource.pipe(Effect.provideService(UpstreamDisk.HostPlatform, "linux"));
const key = { keyId: "KEY1234567", teamId: "TEAM123456", p8: "-----BEGIN PRIVATE KEY-----" };
const device = {
  token: "aa11",
  environment: "production" as const,
  topic: "com.example.cells",
  label: "Phone",
  addedAt: 1,
};

it.layer(NodeServices.layer)("phone pushes on upstream", (it) => {
  it.effect("keeps the key in the secret store and the phones in the state folder", () =>
    Effect.gen(function* () {
      const first = yield* source;
      assert.strictEqual(first.environmentId, "env-1");
      assert.isNull(yield* first.readKey);
      assert.deepStrictEqual(yield* first.loadDevices, []);

      yield* first.writeKey(key);
      yield* first.saveDevices([device]);
      const again = yield* source;
      assert.deepStrictEqual(yield* again.readKey, key);
      assert.deepStrictEqual(yield* again.loadDevices, [device]);

      yield* again.writeKey(null);
      assert.isNull(yield* (yield* source).readKey);
    }).pipe(Effect.provide(Layer.fresh(layerServer))),
  );
});
