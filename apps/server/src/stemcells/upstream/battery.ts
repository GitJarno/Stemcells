import * as HostProcess from "@t3tools/shared/HostProcess";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { ChildProcess, ChildProcessSpawner } from "effect/process";

import type { Charge } from "../../../../../stemcells/words/battery.ts";
import { batteryFromPmset, batteryFromSysfs } from "../power/battery.ts";

// What a machine's battery takes from upstream: the host's platform, its file system and its
// process spawner, and `HostResources`, whose snapshot carries the charge to every client (a seam).

const SUPPLIES = "/sys/class/power_supply";

/**
 * Reads this machine's battery: null without one or on a platform we don't read. A read that
 * fails (a slow `pmset` on a busy machine) says what the last one said, not that it has none.
 */
export const batteryReader = Effect.gen(function* () {
  const platform = yield* HostProcess.Platform;
  const fs = yield* FileSystem.FileSystem;
  const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
  let last: Charge | null = null;

  const read =
    platform === "darwin"
      ? spawner
          .string(
            ChildProcess.make("/usr/bin/pmset", ["-g", "batt"], {
              stdin: "ignore",
              stderr: "ignore",
            }),
          )
          .pipe(Effect.timeout("1 second"), Effect.map(batteryFromPmset))
      : platform === "linux"
        ? Effect.gen(function* () {
            const names = yield* fs.readDirectory(SUPPLIES);
            const name = names.filter((each) => /^BAT\d*$/.test(each)).sort()[0];
            if (name === undefined) return null;
            const [capacity, status] = yield* Effect.all([
              fs.readFileString(`${SUPPLIES}/${name}/capacity`),
              fs.readFileString(`${SUPPLIES}/${name}/status`),
            ]);
            return batteryFromSysfs(capacity, status);
          })
        : Effect.succeed(null);

  return read.pipe(
    Effect.tap((battery) =>
      Effect.sync(() => {
        last = battery;
      }),
    ),
    Effect.orElseSucceed(() => last),
  );
});

/** The snapshot's field: left out on a machine without a battery. */
export const hostResourcesBatteryField = Effect.map(batteryReader, (read) =>
  Effect.map(read, (battery) => (battery === null ? {} : { battery })),
);
