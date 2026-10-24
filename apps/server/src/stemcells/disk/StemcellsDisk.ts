import * as Clock from "effect/Clock";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as FiberHandle from "effect/FiberHandle";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";

import * as UpstreamDisk from "../upstream/disk.ts";
import { diskReport } from "./report.ts";
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

export type DiskReportLook =
  | { readonly measured: true; readonly report: string }
  | { readonly measured: false; readonly counted: number };

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
    /**
     * The measurement as the cleanup Cell reads it: the last one when it is
     * fresh, else one walked now, waited for up to `REPORT_WAIT_MS`.
     */
    readonly report: () => Effect.Effect<DiskReportLook, DiskVolumeError>;
  }
>()("t3/stemcells/disk/StemcellsDisk") {}

/** Older than this, looking measures again. */
const FRESHNESS_MS = 30 * 60_000;
/** A walk nobody looks at for this long stops: the page closed, or the Cell stopped asking. */
const UNWATCHED_MS = 30_000;
/**
 * How long a report call waits on a walk: under the shortest MCP tool
 * timeout a provider sets (Codex's 60 s), so a long walk answers "still
 * measuring" and the Cell calls again.
 */
const REPORT_WAIT_MS = 45_000;

const make = Effect.gen(function* () {
  const readKnownFolders = yield* UpstreamDisk.knownFoldersReader;
  const platform = yield* UpstreamDisk.HostPlatform;
  const folders = machineFolders(platform, yield* UpstreamDisk.HostHome);
  const machine = platform === "darwin" ? "this Mac" : "this computer";
  const walks = yield* FiberHandle.make<void, never>();
  let map: DiskMap | null = null;
  let attemptedAt = 0;
  let lookedAt = 0;
  let scanning = false;
  let counted = 0;
  // Cells waiting on a walk keep it watched, as an open Settings › Disk does.
  let waiting = 0;

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
            cancelled: () => waiting === 0 && Date.now() - lookedAt > UNWATCHED_MS,
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

  const startWalk = Effect.fn("StemcellsDisk.startWalk")(function* (now: number) {
    scanning = true;
    counted = 0;
    attemptedAt = now;
    yield* FiberHandle.run(walks, measure);
  });

  const look = Effect.fn("StemcellsDisk.look")(function* (input: { readonly again: boolean }) {
    const now = yield* Clock.currentTimeMillis;
    lookedAt = now;
    const volume = yield* volumeNow;
    const due = input.again || attemptedAt === 0 || now - attemptedAt > FRESHNESS_MS;
    if (!scanning && due) yield* startWalk(now);
    return {
      volume,
      scanning,
      counted,
      map: map === null ? null : rebased(map, volume),
    } satisfies DiskLook;
  });

  const fresh = (now: number) => map !== null && now - map.measuredAt <= FRESHNESS_MS;

  const report = Effect.fn("StemcellsDisk.report")(function* () {
    if (!fresh(yield* Clock.currentTimeMillis)) {
      if (!scanning) yield* startWalk(yield* Clock.currentTimeMillis);
      waiting += 1;
      yield* FiberHandle.awaitEmpty(walks).pipe(
        Effect.timeoutOption(REPORT_WAIT_MS),
        // A Cell told "still measuring" calls again: the walk gets the same
        // grace an open Settings › Disk would give it, not cancelled at once.
        Effect.ensuring(
          Effect.map(Clock.currentTimeMillis, (now) => {
            waiting -= 1;
            lookedAt = now;
          }),
        ),
      );
    }
    // A walk that failed leaves the last measurement, stale or none.
    if (map === null || scanning) return { measured: false, counted } satisfies DiskReportLook;
    return {
      measured: true,
      report: diskReport(rebased(map, yield* volumeNow), machine),
    } satisfies DiskReportLook;
  });

  const volume = Effect.fn("StemcellsDisk.volume")(function* () {
    return yield* volumeNow;
  });

  return StemcellsDisk.of({ look, volume, report });
});

export const layer = Layer.effect(StemcellsDisk, make);
