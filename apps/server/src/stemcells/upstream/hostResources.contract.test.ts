import * as NodeServices from "@effect/platform-node/NodeServices";
import { assert, it } from "@effect/vitest";
import { HostResourcesSnapshot } from "@t3tools/contracts";
import * as HostProcess from "@t3tools/shared/HostProcess";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as Layer from "effect/Layer";
import { ChildProcessSpawner } from "effect/process";
import * as Schema from "effect/Schema";
import * as Sink from "effect/Sink";
import * as Stream from "effect/Stream";
import * as TestClock from "effect/testing/TestClock";

import * as ServerConfig from "../../config.ts";
import * as HostResources from "../../resourceTelemetry/HostResources.ts";
import { writeHiddenAt } from "../disk/notice.ts";
import { writeWarnBelow } from "../disk/warn.ts";
import * as UpstreamBattery from "./battery.ts";
import * as UpstreamDiskWarn from "./diskWarn.ts";

// Contract: every environment's `server.getHostResources` carries its home volume's free and
// total bytes, how little free space warns the person once they chose, and the free space they
// hid the disk's notice at while that stands (seams.md, Disk on every machine). A server that
// can't read the volume, or predates the fields, still answers.

const decodeSnapshot = Schema.decodeUnknownSync(HostResourcesSnapshot);

const sample = Effect.gen(function* () {
  const resources = yield* HostResources.HostResources;
  // The sample waits 200 ms between two CPU readings.
  const fiber = yield* Effect.forkChild(resources.read);
  yield* TestClock.adjust("200 millis");
  return yield* Fiber.join(fiber);
});

const host = (home: string) =>
  Layer.mergeAll(
    NodeServices.layer,
    // Linux reads memory from a file, so no vm_stat runs.
    Layer.succeed(HostProcess.Platform, "linux"),
    Layer.succeed(HostProcess.HomeDirectory, home),
  );

const readWithHome = (home: string) =>
  sample.pipe(Effect.provide(HostResources.layer.pipe(Layer.provide(host(home)))));

it.effect("host resources carry the home volume's free and total bytes", () =>
  Effect.gen(function* () {
    const snapshot = yield* readWithHome(process.cwd());
    assert.isAbove(snapshot.diskTotalBytes ?? 0, 0);
    assert.isAtLeast(snapshot.diskFreeBytes ?? -1, 0);
    assert.isAtMost(snapshot.diskFreeBytes ?? 0, snapshot.diskTotalBytes ?? 0);
  }),
);

it.effect("host resources carry how little free space warns the person, once they chose", () =>
  Effect.gen(function* () {
    assert.isUndefined((yield* sample).diskWarnBelowBytes);
    yield* writeWarnBelow(yield* UpstreamDiskWarn.diskWarnFile, 10_000_000_000);
    // Past the snapshot's five seconds in its cache.
    yield* TestClock.adjust("6 seconds");
    assert.strictEqual((yield* sample).diskWarnBelowBytes, 10_000_000_000);
  }).pipe(
    Effect.provide(
      HostResources.layer.pipe(
        Layer.provideMerge(
          Layer.mergeAll(
            host(process.cwd()),
            ServerConfig.layerTest(process.cwd(), { prefix: "stemcells-disk-warn-" }).pipe(
              Layer.provide(NodeServices.layer),
            ),
          ),
        ),
      ),
    ),
  ),
);

it.effect("host resources carry the notice's hide while it stands, and forget it once calm", () =>
  Effect.gen(function* () {
    const fields = yield* UpstreamDiskWarn.hostResourcesWarnField;
    yield* writeHiddenAt(yield* UpstreamDiskWarn.diskNoticeFile, 8_000_000_000);
    assert.deepStrictEqual(yield* fields({ diskFreeBytes: 6_000_000_000 }), {
      diskHiddenAtBytes: 8_000_000_000,
    });
    assert.deepStrictEqual(yield* fields({}), {});
    assert.deepStrictEqual(yield* fields({ diskFreeBytes: 30_000_000_000 }), {});
    // The next time the disk runs low, the notice shows.
    assert.deepStrictEqual(yield* fields({ diskFreeBytes: 6_000_000_000 }), {});
  }).pipe(
    Effect.provide(
      Layer.mergeAll(
        NodeServices.layer,
        ServerConfig.layerTest(process.cwd(), { prefix: "stemcells-disk-notice-" }).pipe(
          Layer.provide(NodeServices.layer),
        ),
      ),
    ),
  ),
);

it.effect("host resources answer without them when the volume can't be read", () =>
  Effect.gen(function* () {
    const snapshot = yield* readWithHome("/no/such/home/for/stemcells");
    assert.isUndefined(snapshot.diskFreeBytes);
    assert.isUndefined(snapshot.diskTotalBytes);
    assert.isAbove(snapshot.totalMemoryBytes, 0);
  }),
);

const pmsetHandle = (pmset: string) =>
  ChildProcessSpawner.makeHandle({
    pid: ChildProcessSpawner.ProcessId(1),
    exitCode: Effect.succeed(ChildProcessSpawner.ExitCode(0)),
    isRunning: Effect.succeed(false),
    kill: () => Effect.void,
    unref: Effect.succeed(Effect.void),
    stdin: Sink.drain,
    stdout: Stream.encodeText(Stream.make(pmset)),
    stderr: Stream.empty,
    all: Stream.empty,
    getInputFd: () => Sink.drain,
    getOutputFd: () => Stream.empty,
  });

/** A Mac whose `pmset` answers what `answer` gives; null hangs, as one does on a busy machine. */
const mac = (answer: () => string | null) =>
  Layer.mergeAll(
    NodeServices.layer,
    Layer.succeed(HostProcess.Platform, "darwin"),
    Layer.succeed(HostProcess.HomeDirectory, process.cwd()),
    Layer.succeed(
      ChildProcessSpawner.ChildProcessSpawner,
      ChildProcessSpawner.make(() =>
        Effect.suspend(() => {
          const pmset = answer();
          return pmset === null ? Effect.never : Effect.succeed(pmsetHandle(pmset));
        }),
      ),
    ),
  );

const ON_BATTERY =
  "Now drawing from 'Battery Power'\n -InternalBattery-0 (id=1)\t64%; discharging; 3:10 remaining present: true\n";

it.effect("host resources carry a Mac's battery, and leave it out on a machine with none", () => {
  const read = (pmset: string) =>
    sample.pipe(Effect.provide(HostResources.layer.pipe(Layer.provide(mac(() => pmset)))));
  return Effect.gen(function* () {
    const laptop = yield* read(ON_BATTERY);
    assert.deepStrictEqual(laptop.battery, { percent: 64, power: "battery", minutesLeft: 190 });
    const desktop = yield* read("Now drawing from 'AC Power'\n");
    assert.isUndefined(desktop.battery);
    assert.isAbove(desktop.totalMemoryBytes, 0);
  });
});

it.effect("a read of the battery that fails says what the last one said", () => {
  const answers: Array<string | null> = [ON_BATTERY, null, "Now drawing from 'AC Power'\n"];
  return Effect.gen(function* () {
    const read = yield* UpstreamBattery.batteryReader;
    const charge = { percent: 64, power: "battery" as const, minutesLeft: 190 };
    assert.deepStrictEqual(yield* read, charge);
    const hung = yield* Effect.forkChild(read);
    yield* TestClock.adjust("1 second");
    assert.deepStrictEqual(yield* Fiber.join(hung), charge);
    // A read that answers, and finds none, is believed.
    assert.isNull(yield* read);
  }).pipe(Effect.provide(mac(() => answers.shift() ?? null)));
});

it("a snapshot from a server without them still decodes", () => {
  const snapshot = decodeSnapshot({
    sampledAt: 1,
    cpuUtilization: null,
    cpuCount: 8,
    availableMemoryBytes: 1,
    totalMemoryBytes: 2,
  });
  assert.isUndefined(snapshot.diskFreeBytes);
  assert.isUndefined(snapshot.battery);
});
