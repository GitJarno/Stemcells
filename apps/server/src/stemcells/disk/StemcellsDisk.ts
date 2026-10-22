import * as Clock from "effect/Clock";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as FiberHandle from "effect/FiberHandle";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";

import * as UpstreamDisk from "../upstream/disk.ts";
import { cleanupAsk } from "../../../../../stemcells/words/disk.ts";
import { cleanupDraft } from "./report.ts";
import {
  diskMap,
  machineFolders,
  readVolume,
  rebased,
  walkDisk,
  type DiskMap,
  type DiskVolume,
} from "./walk.ts";

export class DiskVolumeError extends Schema.TaggedError<DiskVolumeError>()("DiskVolumeError", {
  cause: Schema.Defect(),
}) {
  override get message(): string {
    return "Could not read the size of the disk.";
  }
}

class DiskWalkError extends Schema.TaggedError<DiskWalkError>()("DiskWalkError", {
  cause: Schema.Defect(),
}) {
  override get message(): string {
    return "The disk walk failed.";
  }
}

export interface DiskLook {
  readonly volume: DiskVolume;
  readonly scanning: boolean;
  /** Bytes the walk under way has counted. */
  readonly counted: number;
  /** The last measurement, against the volume as it is now. */
  readonly map: DiskMap | null;
}

export class StemcellsDisk extends Context.Service<
  StemcellsDisk,
  {
    /**
     * The disk now and the last measurement. Starts a walk, off the request,
     * when there is none yet, the last is old, or `again` asks for one.
     */
    readonly look: (input: { readonly again: boolean }) => Effect.Effect<DiskLook, DiskVolumeError>;
    /** The disk now, one `statfs`: never starts a walk, never keeps one alive. */
    readonly volume: () => Effect.Effect<DiskVolume, DiskVolumeError>;
    /** The cleanup Cell's first message, with the last measurement once there is one. */
    readonly cleanupDraft: () => Effect.Effect<string, DiskVolumeError>;
  }
>()("t3/stemcells/disk/StemcellsDisk") {}

/** Older than this, looking measures again. */
const FRESHNESS_MS = 30 * 60_000;
/** A walk nobody looks at for this long stops: the page was closed. */
const UNWATCHED_MS = 30_000;

const make = Effect.gen(function* () {
  const readKnownFolders = yield* UpstreamDisk.knownFoldersReader;
  const platform = yield* UpstreamDisk.HostPlatform;
  const folders = machineFolders(platform);
  const machine = platform === "darwin" ? "this Mac" : "this computer";
  const walks = yield* FiberHandle.make<void>();
  let map: DiskMap | null = null;
  let attemptedAt = 0;
  let lookedAt = 0;
  let scanning = false;
  let counted = 0;

  const volumeNow = Effect.tryPromise({
    try: () => readVolume(folders.home),
    catch: (cause) => new DiskVolumeError({ cause }),
  });

  const measure = Effect.gen(function* () {
    const known = yield* readKnownFolders;
    const walk = yield* Effect.tryPromise({
      try: (signal) =>
        walkDisk(
          { ...folders, ...known },
          {
            signal,
            // @effect-diagnostics-next-line globalDate:off -- The walk asks between folders, outside the Effect runtime.
            cancelled: () => Date.now() - lookedAt > UNWATCHED_MS,
            onProgress: (bytes) => {
              counted = bytes;
            },
          },
        ),
      catch: (cause) => new DiskWalkError({ cause }),
    });
    if (walk === null) {
      // Stopped unwatched: the next look starts over rather than waiting out the freshness.
      attemptedAt = 0;
      return;
    }
    const volume = yield* volumeNow;
    map = diskMap(walk, volume, { measuredAt: yield* Clock.currentTimeMillis });
  }).pipe(
    Effect.catchTags({
      DiskWalkError: (error) => Effect.logWarning("Disk walk failed", error),
      DiskVolumeError: (error) => Effect.logWarning("Disk walk failed", error),
    }),
    Effect.ensuring(
      Effect.sync(() => {
        scanning = false;
      }),
    ),
    Effect.withSpan("StemcellsDisk.measure"),
  );

  const look = Effect.fn("StemcellsDisk.look")(function* (input: { readonly again: boolean }) {
    const now = yield* Clock.currentTimeMillis;
    lookedAt = now;
    const volume = yield* volumeNow;
    const due = input.again || attemptedAt === 0 || now - attemptedAt > FRESHNESS_MS;
    if (!scanning && due) {
      scanning = true;
      counted = 0;
      attemptedAt = now;
      yield* FiberHandle.run(walks, measure);
    }
    return {
      volume,
      scanning,
      counted,
      map: map === null ? null : rebased(map, volume),
    } satisfies DiskLook;
  });

  const draft = Effect.fn("StemcellsDisk.cleanupDraft")(function* () {
    if (map === null) return cleanupAsk(machine);
    return cleanupDraft(rebased(map, yield* volumeNow), machine);
  });

  const volume = Effect.fn("StemcellsDisk.volume")(function* () {
    return yield* volumeNow;
  });

  return StemcellsDisk.of({ look, volume, cleanupDraft: draft });
});

export const layer = Layer.effect(StemcellsDisk, make);
