import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Option from "effect/Option";

import * as ServerConfig from "../../config.ts";
import { diskChoices, noticeFile } from "../disk/notice.ts";
import { warnFile } from "../disk/warn.ts";

// What the disk's warning and its notice's hide take from upstream: the state folder, and
// `HostResources`, whose snapshot carries both to every client beside the disk's figures (a seam).

/** Where this server keeps the person's choices about its disk. */
export const diskStateDir = Effect.map(ServerConfig.ServerConfig, (config) => config.stateDir);

/** This server's file. */
export const diskWarnFile = Effect.map(diskStateDir, warnFile);

/** This server's hide of the phone's disk notice. */
export const diskNoticeFile = Effect.map(diskStateDir, noticeFile);

/**
 * The snapshot's fields for the disk it sampled, read each sample: each left out while the
 * person hasn't chosen, the hide once it's spent (and forgotten), and both where no server
 * config is provided (upstream's own tests of `HostResources`).
 */
export const hostResourcesWarnField = Effect.gen(function* () {
  const config = yield* Effect.serviceOption(ServerConfig.ServerConfig);
  const fs = yield* FileSystem.FileSystem;
  return (disk: { readonly diskFreeBytes?: number }) =>
    Option.isNone(config)
      ? Effect.succeed({})
      : diskChoices(config.value.stateDir, disk.diskFreeBytes).pipe(
          Effect.map(({ warnBelow, hiddenAt }) => ({
            ...(warnBelow === null ? {} : { diskWarnBelowBytes: warnBelow }),
            ...(hiddenAt === null ? {} : { diskHiddenAtBytes: hiddenAt }),
          })),
          Effect.provideService(FileSystem.FileSystem, fs),
        );
});
