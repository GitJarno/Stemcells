import * as Cache from "effect/Cache";
import * as Clock from "effect/Clock";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as FiberMap from "effect/FiberMap";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";
import * as Semaphore from "effect/Semaphore";
import * as Stream from "effect/Stream";
import { ChildProcess, ChildProcessSpawner } from "effect/process";

import * as UpstreamDisk from "../upstream/disk.ts";
import * as UpstreamDiskWarn from "../upstream/diskWarn.ts";
import {
  driveDetail,
  isDiskImage,
  isVolumesMount,
  makeDuTally,
  parseDf,
  parseDiskInfo,
  type DriveFolders,
} from "./drives.ts";
import { readVolume } from "./walk.ts";

// Every drive on this machine. Reading how full one is touches none of its files, so it raises no
// macOS privacy prompt and wakes no sleeping disk. Looking inside is the person's choice, per
// drive, remembered by the volume's UUID so a different drive with the same name inherits nothing.
// Network shares stay out (`df -l`): a dead one hangs whoever asks.

export const STARTUP_DRIVE = "startup";

class DriveToolError extends Schema.TaggedError<DriveToolError>()("DriveToolError", {
  cause: Schema.Defect(),
}) {
  override get message(): string {
    return "A disk tool didn't answer.";
  }
}

export class DriveChoiceError extends Schema.TaggedError<DriveChoiceError>()("DriveChoiceError", {
  cause: Schema.Defect(),
}) {
  override get message(): string {
    return "Couldn't keep the choice about a drive.";
  }
}

export interface Drive {
  readonly id: string;
  readonly name: string;
  readonly role: "startup" | "internal" | "external";
  readonly total: number;
  readonly free: number;
  /** "USB · Mac OS Extended", where the drive says. */
  readonly detail: string | null;
  readonly lookInside: boolean;
  /** False without a UUID to remember the choice by, and for the startup drive, always measured. */
  readonly canLookInside: boolean;
}

export interface DriveLook {
  readonly drive: Drive;
  readonly scanning: boolean;
  readonly counted: number;
  readonly measuredAt: number | null;
  /** Stopped short: every size is at least what it says. */
  readonly partial: boolean;
  /** `du` couldn't open the drive: macOS hasn't let this app read it. */
  readonly denied: boolean;
  readonly folders: DriveFolders["folders"];
}

/** What the service asks of the machine; the tests answer in its place. */
export interface DriveTools {
  /** `df -Plk`. */
  readonly df: Effect.Effect<string, DriveToolError>;
  /** `diskutil info -plist <mount>`. */
  readonly diskInfo: (mount: string) => Effect.Effect<string, DriveToolError>;
  /** `du -x -k -d 2 <mount>`, a line at a time; killed when the stream ends early. */
  readonly du: (mount: string) => Stream.Stream<string, DriveToolError>;
  /** The startup volume. */
  readonly startup: Effect.Effect<
    { readonly total: number; readonly free: number },
    DriveToolError
  >;
}

export class StemcellsDrives extends Context.Service<
  StemcellsDrives,
  {
    /** The startup drive first, then the rest by their mounts. */
    readonly list: () => Effect.Effect<ReadonlyArray<Drive>>;
    /** A drive besides the startup one, or null. Starts `du` only on a drive the person opened. */
    readonly look: (input: {
      readonly id: string;
      readonly again: boolean;
    }) => Effect.Effect<DriveLook | null>;
    /** Remembers the choice; null when no such drive is mounted, or it can't be remembered. */
    readonly setLookInside: (input: {
      readonly id: string;
      readonly on: boolean;
    }) => Effect.Effect<Drive | null, DriveChoiceError>;
  }
>()("t3/stemcells/disk/StemcellsDrives") {}

/** A drive's figures may be this old: a second's worth of pages or phones asking starts one `df`. */
const LIST_TTL = "3 seconds";
/** Older than this, opening a drive measures it again: walking one wakes it. */
const FRESHNESS_MS = 6 * 60 * 60_000;
/** A walk nobody looks at for this long stops: the page closed. */
const UNWATCHED_MS = 30_000;
const WALK_LIMIT = "20 minutes";

const Opened = Schema.fromJsonString(Schema.Struct({ lookInside: Schema.Array(Schema.String) }));
const decodeOpened = Schema.decodeUnknownEffect(Opened);
const encodeOpened = Schema.encodeEffect(Opened);

export const drivesFile = (stateDir: string) => `${stateDir}/stemcells/disk-drives.json`;

interface Walked {
  scanning: boolean;
  counted: number;
  attemptedAt: number | null;
  lookedAt: number;
  measuredAt: number | null;
  partial: boolean;
  denied: boolean;
  folders: DriveFolders["folders"];
}

const unmeasured = (): Walked => ({
  scanning: false,
  counted: 0,
  attemptedAt: null,
  lookedAt: 0,
  measuredAt: null,
  partial: false,
  denied: false,
  folders: [],
});

export const makeDrives = Effect.fn("StemcellsDrives.make")(function* (
  tools: DriveTools,
  file: string,
  fallbackName: string,
) {
  const fs = yield* FileSystem.FileSystem;
  const walks = yield* FiberMap.make<string, void, never>();
  const walked = new Map<string, Walked>();
  const opened = new Set(
    yield* fs.readFileString(file).pipe(
      Effect.flatMap((text) => decodeOpened(text)),
      Effect.map((kept) => kept.lookInside),
      Effect.orElseSucceed((): ReadonlyArray<string> => []),
    ),
  );
  const mounts = new Map<string, string>();
  // A mount's make-up doesn't change while it stays mounted: one `diskutil` per mounting.
  const infos = new Map<string, ReturnType<typeof parseDiskInfo>>();

  const infoOf = Effect.fn("StemcellsDrives.infoOf")(function* (device: string, mount: string) {
    const key = `${device}\u0000${mount}`;
    const known = infos.get(key);
    if (known !== undefined) return known;
    const info = parseDiskInfo(yield* tools.diskInfo(mount));
    infos.set(key, info);
    return info;
  });

  const readDrives = Effect.gen(function* () {
    const startup = yield* tools.startup.pipe(Effect.orElseSucceed(() => null));
    const startupInfo = yield* infoOf(STARTUP_DRIVE, "/").pipe(Effect.orElseSucceed(() => null));
    const mounted = yield* tools.df.pipe(
      Effect.map(parseDf),
      Effect.orElseSucceed((): ReturnType<typeof parseDf> => []),
    );
    const drives: Array<Drive> = [];
    if (startup !== null) {
      drives.push({
        id: STARTUP_DRIVE,
        name: startupInfo?.name ?? fallbackName,
        role: "startup",
        ...startup,
        detail: startupInfo === null ? null : driveDetail(startupInfo),
        lookInside: true,
        canLookInside: false,
      });
    }
    const seen = new Set([`${STARTUP_DRIVE}\u0000/`]);
    mounts.clear();
    for (const volume of mounted) {
      if (!isVolumesMount(volume.mount)) continue;
      // A drive that doesn't answer stays off the list until it does.
      const info = yield* infoOf(volume.device, volume.mount).pipe(
        Effect.orElseSucceed(() => null),
      );
      seen.add(`${volume.device}\u0000${volume.mount}`);
      if (info === null || isDiskImage(info)) continue;
      const id = info.uuid ?? volume.device;
      // A clone mounted beside its original has the same UUID, and one choice can't name both.
      if (mounts.has(id)) continue;
      mounts.set(id, volume.mount);
      drives.push({
        id,
        name: info.name ?? volume.mount.slice("/Volumes/".length),
        role: info.internal ? "internal" : "external",
        total: volume.total,
        free: volume.free,
        detail: driveDetail(info),
        lookInside: info.uuid !== null && opened.has(info.uuid),
        canLookInside: info.uuid !== null,
      });
    }
    for (const key of infos.keys()) if (!seen.has(key)) infos.delete(key);
    return drives;
  });

  const cache = yield* Cache.make({
    capacity: 1,
    lookup: (_key: "drives") => readDrives,
    timeToLive: LIST_TTL,
  });
  const list = () => Cache.get(cache, "drives");

  const walkOf = (id: string) => {
    const known = walked.get(id);
    if (known !== undefined) return known;
    const fresh = unmeasured();
    walked.set(id, fresh);
    return fresh;
  };

  const walk = Effect.fn("StemcellsDrives.walk")(function* (id: string, mount: string) {
    const state = walkOf(id);
    const tally = makeDuTally(mount);
    const unwatched = Effect.gen(function* () {
      while (true) {
        yield* Effect.sleep("5 seconds");
        if ((yield* Clock.currentTimeMillis) - state.lookedAt > UNWATCHED_MS) return false;
      }
    });
    const finished = tools.du(mount).pipe(
      Stream.runForEach((line) =>
        Effect.sync(() => {
          tally.add(line);
          state.counted = tally.counted();
        }),
      ),
      Effect.as(true),
      Effect.orElseSucceed(() => true),
    );
    const whole = yield* finished.pipe(
      Effect.raceFirst(unwatched),
      Effect.timeoutOption(WALK_LIMIT),
    );
    const { folders, read } = tally.result();
    state.folders = folders;
    state.partial = whole._tag === "None" || !whole.value;
    state.denied = !state.partial && !read;
    state.measuredAt = yield* Clock.currentTimeMillis;
    // Stopped unwatched, the next look starts over. Stopped at the limit, it waits out the
    // freshness: a drive too big for one walk would otherwise be walked for as long as it's open.
    if (whole._tag === "Some" && !whole.value) state.attemptedAt = null;
  });

  const look = Effect.fn("StemcellsDrives.look")(function* (input: {
    readonly id: string;
    readonly again: boolean;
  }) {
    const drive = (yield* list()).find((each) => each.id === input.id && each.id !== STARTUP_DRIVE);
    if (drive === undefined) return null;
    const state = walkOf(drive.id);
    const now = yield* Clock.currentTimeMillis;
    state.lookedAt = now;
    const mount = mounts.get(drive.id);
    const due = input.again || state.attemptedAt === null || now - state.attemptedAt > FRESHNESS_MS;
    if (drive.lookInside && mount !== undefined && due && !state.scanning) {
      state.scanning = true;
      state.counted = 0;
      state.attemptedAt = now;
      yield* FiberMap.run(
        walks,
        drive.id,
        walk(drive.id, mount).pipe(
          Effect.ensuring(
            Effect.sync(() => {
              state.scanning = false;
            }),
          ),
        ),
      );
    }
    return {
      drive,
      scanning: state.scanning,
      counted: state.counted,
      measuredAt: state.measuredAt,
      partial: state.partial,
      denied: state.denied,
      folders: state.folders,
    } satisfies DriveLook;
  });

  const keeping = yield* Semaphore.make(1);

  const setLookInside = Effect.fn("StemcellsDrives.setLookInside")(function* (input: {
    readonly id: string;
    readonly on: boolean;
  }) {
    const drive = (yield* list()).find((each) => each.id === input.id && each.canLookInside);
    if (drive === undefined) return null;
    yield* keeping.withPermit(
      Effect.gen(function* () {
        const next = new Set(opened);
        if (input.on) next.add(drive.id);
        else next.delete(drive.id);
        const temporary = `${file}.tmp`;
        yield* fs.makeDirectory(file.slice(0, file.lastIndexOf("/")), { recursive: true });
        yield* fs.writeFileString(temporary, yield* encodeOpened({ lookInside: [...next] }));
        yield* fs.rename(temporary, file);
        // Only once it's kept: what's remembered and what's on disk never disagree.
        if (input.on) opened.add(drive.id);
        else opened.delete(drive.id);
      }).pipe(Effect.mapError((cause) => new DriveChoiceError({ cause }))),
    );
    if (!input.on) {
      // Closing forgets what was seen. Not waited for: a `du` stuck on a failing disk outlives its
      // kill until the disk goes, and the person's answer shouldn't wait on it.
      walked.delete(drive.id);
      yield* FiberMap.remove(walks, drive.id).pipe(Effect.forkDetach);
    }
    yield* Cache.invalidate(cache, "drives");
    return { ...drive, lookInside: input.on };
  });

  return {
    service: StemcellsDrives.of({ list, look, setLookInside }),
    /** Every walk under way has ended. */
    walksEnded: FiberMap.awaitEmpty(walks),
  };
});

/** The tools as macOS has them. */
export const processTools = Effect.gen(function* () {
  const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
  const home = yield* UpstreamDisk.HostHome;
  const platform = yield* UpstreamDisk.HostPlatform;
  const toolError = (cause: unknown) => new DriveToolError({ cause });
  const run = (command: string, args: ReadonlyArray<string>) =>
    spawner
      .string(
        ChildProcess.make(command, args, {
          stdin: "ignore",
          stderr: "ignore",
          forceKillAfter: "1 second",
        }),
      )
      .pipe(Effect.timeout("4 seconds"), Effect.mapError(toolError));
  return {
    // Off a Mac there's the home's volume and nothing else this reads.
    df: platform === "darwin" ? run("/bin/df", ["-Plk"]) : Effect.succeed(""),
    diskInfo: (mount) =>
      platform === "darwin"
        ? run("/usr/sbin/diskutil", ["info", "-plist", mount])
        : Effect.fail(toolError("not a Mac")),
    du: (mount) =>
      Stream.unwrap(
        spawner
          .spawn(
            ChildProcess.make(
              "/usr/bin/nice",
              ["-n", "10", "/usr/bin/du", "-x", "-k", "-d", "2", mount],
              {
                stdin: "ignore",
                stderr: "ignore",
                forceKillAfter: "2 seconds",
              },
            ),
          )
          .pipe(Effect.map((handle) => handle.stdout.pipe(Stream.decodeText, Stream.splitLines))),
      ).pipe(Stream.mapError(toolError)),
    startup: Effect.tryPromise(() => readVolume(home)).pipe(
      Effect.timeout("2 seconds"),
      Effect.mapError(toolError),
    ),
  } satisfies DriveTools;
});

export const layer = Layer.effect(
  StemcellsDrives,
  Effect.gen(function* () {
    const tools = yield* processTools;
    const stateDir = yield* UpstreamDiskWarn.diskStateDir;
    const platform = yield* UpstreamDisk.HostPlatform;
    const { service } = yield* makeDrives(
      tools,
      drivesFile(stateDir),
      platform === "darwin" ? "This Mac" : "This computer",
    );
    return service;
  }),
);
