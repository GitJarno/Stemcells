import * as NodeServices from "@effect/platform-node/NodeServices";
import { assert, it } from "@effect/vitest";
import { HostResourcesSnapshot } from "@t3tools/contracts";
import * as HostProcess from "@t3tools/shared/HostProcess";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";
import * as TestClock from "effect/testing/TestClock";

import * as HostResources from "../../resourceTelemetry/HostResources.ts";

// Contract: every environment's `server.getHostResources` carries its home
// volume's free and total bytes, which Settings › Disk shows for each
// machine (seams.md, Disk on every machine). A server that can't read the
// volume, or predates the fields, still answers, without them.

const decodeSnapshot = Schema.decodeUnknownSync(HostResourcesSnapshot);

const readWithHome = (home: string) =>
  Effect.gen(function* () {
    const resources = yield* HostResources.HostResources;
    // The sample waits 200 ms between two CPU readings.
    const fiber = yield* Effect.forkChild(resources.read);
    yield* TestClock.adjust("200 millis");
    return yield* Fiber.join(fiber);
  }).pipe(
    Effect.provide(
      HostResources.layer.pipe(
        Layer.provide(
          Layer.mergeAll(
            NodeServices.layer,
            // Linux reads memory from a file, so no vm_stat runs.
            Layer.succeed(HostProcess.Platform, "linux"),
            Layer.succeed(HostProcess.HomeDirectory, home),
          ),
        ),
      ),
    ),
  );

it.effect("host resources carry the home volume's free and total bytes", () =>
  Effect.gen(function* () {
    const snapshot = yield* readWithHome(process.cwd());
    assert.isAbove(snapshot.diskTotalBytes ?? 0, 0);
    assert.isAtLeast(snapshot.diskFreeBytes ?? -1, 0);
    assert.isAtMost(snapshot.diskFreeBytes ?? 0, snapshot.diskTotalBytes ?? 0);
  }),
);

it.effect("host resources answer without them when the volume can't be read", () =>
  Effect.gen(function* () {
    const snapshot = yield* readWithHome("/no/such/home/for/stemcells");
    assert.isUndefined(snapshot.diskFreeBytes);
    assert.isUndefined(snapshot.diskTotalBytes);
    assert.isAbove(snapshot.totalMemoryBytes, 0);
  }),
);

it("a snapshot from a server without them still decodes", () => {
  const snapshot = decodeSnapshot({
    sampledAt: 1,
    cpuUtilization: null,
    cpuCount: 8,
    availableMemoryBytes: 1,
    totalMemoryBytes: 2,
  });
  assert.isUndefined(snapshot.diskFreeBytes);
});
