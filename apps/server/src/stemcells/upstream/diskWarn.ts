import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Option from "effect/Option";

import * as ServerConfig from "../../config.ts";
import { readWarnBelow, warnFile } from "../disk/warn.ts";

// What the disk's warning takes from upstream: the state folder, and `HostResources`, whose
// snapshot carries the choice to every client beside the disk's figures (a seam).

/** This server's file. */
export const diskWarnFile = Effect.map(ServerConfig.ServerConfig, (config) =>
  warnFile(config.stateDir),
);

/**
 * The snapshot's field, read each sample: left out while the person hasn't chosen, and where
 * no server config is provided (upstream's own tests of `HostResources`).
 */
export const hostResourcesWarnField = Effect.gen(function* () {
  const config = yield* Effect.serviceOption(ServerConfig.ServerConfig);
  const fs = yield* FileSystem.FileSystem;
  if (Option.isNone(config)) return Effect.succeed({});
  return readWarnBelow(warnFile(config.value.stateDir)).pipe(
    Effect.map((warnBelow) => (warnBelow === null ? {} : { diskWarnBelowBytes: warnBelow })),
    Effect.provideService(FileSystem.FileSystem, fs),
  );
});
