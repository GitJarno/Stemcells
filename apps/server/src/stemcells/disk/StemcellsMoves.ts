import * as Cause from "effect/Cause";
import * as Clock from "effect/Clock";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as FiberSet from "effect/FiberSet";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import * as Semaphore from "effect/Semaphore";
import { ChildProcess, ChildProcessSpawner } from "effect/process";

import * as UpstreamDisk from "../upstream/disk.ts";
import * as UpstreamDiskWarn from "../upstream/diskWarn.ts";
import {
  bootedSimulators,
  canHold,
  decodeMoves,
  driveRelative,
  encodeMoves,
  MOVERS,
  movesFile,
  roomFor,
  sameTally,
  simulatorIds,
  type MovableKind,
  type MoveRecord,
  type Tally,
} from "./moves.ts";
import * as StemcellsDrives from "./StemcellsDrives.ts";

// Moves a folder a Mac rebuilds on its own to a drive with room, leaving a link in its place, and
// back. Copy beside, check, switch, check again, and only then delete: a switch whose folder doesn't
// answer is undone while the original still sits beside it. One move at a time.

export class MoveError extends Schema.TaggedError<MoveError>()("MoveError", {
  /** What the person reads. */
  reason: Schema.String,
  cause: Schema.optional(Schema.Defect()),
}) {
  override get message(): string {
    return this.reason;
  }
}

const isMoveError = Schema.is(MoveError);

const fail = (reason: string, cause?: unknown) =>
  Effect.fail(new MoveError({ reason, ...(cause === undefined ? {} : { cause }) }));

export type MovePhase =
  | "measuring"
  | "copying"
  | "checking"
  | "switching"
  | "permission"
  | "finishing";

export interface MoveJob {
  readonly kind: MovableKind;
  readonly direction: "away" | "back";
  readonly driveName: string;
  readonly phase: MovePhase;
  /** Bytes written so far and in all, while copying. */
  readonly done: number;
  readonly total: number;
}

export interface MoveOutcome {
  readonly kind: MovableKind;
  readonly direction: "away" | "back" | "fresh";
  readonly ok: boolean;
  readonly reason: string | null;
  readonly at: number;
}

export interface MovePlace {
  readonly kind: MovableKind;
  /** "here" on the startup drive; "away" on a drive, connected or not; "none" when it doesn't exist. */
  readonly where: "here" | "away" | "none";
  readonly drive?: { readonly id: string; readonly name: string; readonly connected: boolean };
  readonly bytes?: number;
}

export interface MovesStatus {
  readonly places: ReadonlyArray<MovePlace>;
  readonly job: MoveJob | null;
  readonly last: MoveOutcome | null;
}

/** What a move runs on the machine; a test hands in fakes. */
export interface MoveTools {
  /** Copies a folder with everything a Mac keeps on it (`ditto`), at low priority. */
  readonly copy: (from: string, to: string) => Effect.Effect<void, MoveError>;
  readonly tally: (dir: string) => Effect.Effect<Tally, MoveError>;
  readonly freeBytes: (path: string) => Effect.Effect<number, MoveError>;
  readonly remove: (dir: string) => Effect.Effect<void, MoveError>;
  /** The booted simulators' names; fails when the simulator service doesn't answer. */
  readonly bootedSimulators: Effect.Effect<ReadonlyArray<string>, MoveError>;
  /** Every simulator's id, or none when the service doesn't answer within `seconds`. */
  readonly simulatorIds: (seconds: number) => Effect.Effect<ReadonlyArray<string> | null>;
  /** Restarts the simulator service so it reads its devices from where they now are. */
  readonly restartSimulators: Effect.Effect<void, MoveError>;
  readonly xcodeRunning: Effect.Effect<boolean>;
}

export class StemcellsMoves extends Context.Service<
  StemcellsMoves,
  {
    readonly status: () => Effect.Effect<MovesStatus>;
    /** Starts moving `kind` to the drive `driveId`; fails at once when it can't start. */
    readonly moveAway: (input: {
      readonly kind: MovableKind;
      readonly driveId: string;
    }) => Effect.Effect<void, MoveError>;
    /** Starts moving `kind` back to this Mac from its drive. */
    readonly moveBack: (kind: MovableKind) => Effect.Effect<void, MoveError>;
    /** For a drive that's gone: an empty folder here in place of the link, and the record forgotten. */
    readonly startFresh: (kind: MovableKind) => Effect.Effect<void, MoveError>;
  }
>()("t3/stemcells/disk/StemcellsMoves") {}

/** A first read of a moved folder on an external drive can wait on macOS asking the person. */
const ANSWER_SECONDS = 20;
const PERMISSION_SECONDS = 5 * 60;
const TICK = "2 seconds";
/** `launchctl kickstart`'s exit when a domain has no such service. */
const NOT_LOADED = 113;

export const makeMoves = Effect.fn("StemcellsMoves.make")(function* (options: {
  readonly tools: MoveTools;
  readonly home: string;
  readonly file: string;
  readonly drives: StemcellsDrives.StemcellsDrives["Service"];
}) {
  const { tools, home, file, drives } = options;
  const fs = yield* FileSystem.FileSystem;
  const running = yield* FiberSet.make<void, never>();
  const one = yield* Semaphore.make(1);
  let job: MoveJob | null = null;
  let last: MoveOutcome | null = null;
  let records: ReadonlyArray<MoveRecord> = yield* fs.readFileString(file).pipe(
    Effect.flatMap(decodeMoves),
    Effect.map((kept) => kept.moves),
    Effect.orElseSucceed((): ReadonlyArray<MoveRecord> => []),
  );

  const folderOf = (kind: MovableKind) => `${home}/${MOVERS[kind]!.path}`;

  const keep = Effect.fn("StemcellsMoves.keep")(
    function* (next: ReadonlyArray<MoveRecord>) {
      const temporary = `${file}.tmp`;
      yield* fs.makeDirectory(file.slice(0, file.lastIndexOf("/")), { recursive: true });
      yield* fs.writeFileString(temporary, encodeMoves(next));
      yield* fs.rename(temporary, file);
      records = next;
    },
    Effect.mapError(
      (cause) => new MoveError({ reason: "Couldn't keep the record of the move.", cause }),
    ),
  );

  /** Null when nothing that uses the folder is running, else why it can't move now. */
  const busy = Effect.fn("StemcellsMoves.busy")(function* (kind: MovableKind) {
    if (MOVERS[kind]!.quiet === "simulators") {
      const booted = yield* tools.bootedSimulators;
      if (booted.length === 0) return null;
      return booted.length === 1
        ? `The simulator ${booted[0]} is running. Close it first.`
        : `${booted.length} simulators are running (${booted.join(", ")}). Close them first.`;
    }
    return (yield* tools.xcodeRunning) ? "Xcode is running. Quit it first." : null;
  });

  const linkTarget = (path: string) => fs.readLink(path).pipe(Effect.orElseSucceed(() => null));

  const isFolder = (path: string) =>
    fs.stat(path).pipe(
      Effect.map((info) => info.type === "Directory"),
      Effect.orElseSucceed(() => false),
    );

  const exists = (path: string) => fs.exists(path).pipe(Effect.orElseSucceed(() => true));

  /** Whether the deepest folder that exists on the way from `mount` to `dir` lets this account write. */
  const canWriteToward = Effect.fn("StemcellsMoves.canWriteToward")(function* (
    mount: string,
    dir: string,
  ) {
    let at = dir;
    while (at.length > mount.length && !(yield* isFolder(at)))
      at = at.slice(0, at.lastIndexOf("/"));
    return yield* fs.access(at, { writable: true }).pipe(
      Effect.as(true),
      Effect.orElseSucceed(() => false),
    );
  });

  const recordOf = (kind: MovableKind) => records.find((each) => each.kind === kind);

  /** For simulators, the service is restarted and must list the devices it listed before. */
  const answers = Effect.fn("StemcellsMoves.answers")(function* (
    kind: MovableKind,
    before: ReadonlyArray<string> | null,
    folder: string,
  ) {
    if (MOVERS[kind]!.quiet !== "simulators") return yield* isFolder(folder);
    yield* tools.restartSimulators;
    let ids = yield* tools.simulatorIds(ANSWER_SECONDS);
    if (ids === null) {
      if (job !== null) job = { ...job, phase: "permission" };
      ids = yield* tools.simulatorIds(PERMISSION_SECONDS);
    }
    return ids !== null && before !== null && ids.join() === before.join();
  });

  const copyWatched = Effect.fn("StemcellsMoves.copyWatched")(function* (
    from: string,
    to: string,
    total: number,
    freeAt: string,
  ) {
    const freeBefore = yield* tools.freeBytes(freeAt);
    const ticker = Effect.gen(function* () {
      while (true) {
        yield* Effect.sleep(TICK);
        const free = yield* tools.freeBytes(freeAt).pipe(Effect.orElseSucceed(() => freeBefore));
        if (job !== null) job = { ...job, done: Math.min(total, Math.max(0, freeBefore - free)) };
      }
    });
    yield* tools.copy(from, to).pipe(Effect.raceFirst(ticker));
    if (job !== null) job = { ...job, done: total, phase: "checking" };
    const [source, copy] = [yield* tools.tally(from), yield* tools.tally(to)];
    if (!sameTally(source, copy)) {
      yield* tools.remove(to);
      return yield* fail("The copy didn't come out whole, so nothing moved.");
    }
  });

  /** A folder's bytes, once there's room for them where they go; the job copies from then on. */
  const measured = Effect.fn("StemcellsMoves.measured")(function* (
    folder: string,
    goingTo: string,
    noRoom: string,
  ) {
    const total = (yield* tools.tally(folder)).kilobytes * 1024;
    if ((yield* tools.freeBytes(goingTo)) < roomFor(total)) return yield* fail(noRoom);
    if (job !== null) job = { ...job, phase: "copying", total };
    return total;
  });

  /** The simulators listed before a move, to know them again after; null for other folders. */
  const listedBefore = (kind: MovableKind) =>
    MOVERS[kind]!.quiet === "simulators"
      ? tools.simulatorIds(ANSWER_SECONDS).pipe(
          Effect.filterOrFail(
            (ids): ids is ReadonlyArray<string> => ids !== null,
            () =>
              new MoveError({
                reason: "The simulator service isn't answering. Try again in a minute.",
              }),
          ),
        )
      : Effect.succeed(null);

  const awayWork = Effect.fn("StemcellsMoves.away")(function* (
    kind: MovableKind,
    place: StemcellsDrives.DrivePlace,
    machine: string,
    total: number,
    before: ReadonlyArray<string> | null,
  ) {
    const folder = folderOf(kind);
    const relative = driveRelative(machine, MOVERS[kind]!.path);
    const target = `${place.mount}/${relative}`;
    const partial = `${target}.partial`;
    const old = `${folder}.stemcells-old`;
    yield* fs
      .makeDirectory(target.slice(0, target.lastIndexOf("/")), { recursive: true })
      .pipe(
        Effect.mapError(
          (cause) => new MoveError({ reason: `Couldn't write to ${place.drive.name}.`, cause }),
        ),
      );
    yield* tools.remove(partial);
    yield* copyWatched(folder, partial, total, place.mount);

    const stillBusy = yield* busy(kind);
    if (stillBusy !== null) {
      yield* tools.remove(partial);
      return yield* fail(stillBusy);
    }
    if (job !== null) job = { ...job, phase: "switching" };
    const fsError = (cause: unknown) =>
      new MoveError({ reason: "Couldn't switch the folder over.", cause });
    yield* fs.rename(partial, target).pipe(Effect.mapError(fsError));
    yield* fs.rename(folder, old).pipe(Effect.mapError(fsError));
    yield* fs.symlink(target, folder).pipe(Effect.mapError(fsError));

    // Any failure past the switch undoes it, so a move never stops halfway.
    if (!(yield* answers(kind, before, folder).pipe(Effect.orElseSucceed(() => false)))) {
      yield* fs.remove(folder).pipe(Effect.ignore);
      yield* fs.rename(old, folder).pipe(Effect.ignore);
      if (MOVERS[kind]!.quiet === "simulators") yield* tools.restartSimulators.pipe(Effect.ignore);
      yield* tools.remove(target).pipe(Effect.ignore);
      return yield* fail(
        `The simulators didn't open from ${place.drive.name}, so they stay on this Mac. If macOS asked whether the simulator may use the drive, allow it and try again.`,
      );
    }
    const at = yield* Clock.currentTimeMillis;
    yield* keep([
      ...records.filter((each) => each.kind !== kind),
      {
        kind,
        driveId: place.drive.id,
        driveName: place.drive.name,
        relative,
        bytes: total,
        movedAt: at,
      },
    ]);
    if (job !== null) job = { ...job, phase: "finishing" };
    yield* tools.remove(old);
  });

  const backWork = Effect.fn("StemcellsMoves.back")(function* (
    kind: MovableKind,
    record: MoveRecord,
    target: string,
    total: number,
    before: ReadonlyArray<string> | null,
  ) {
    const folder = folderOf(kind);
    const back = `${folder}.stemcells-back`;
    yield* tools.remove(back);
    yield* copyWatched(target, back, total, home);
    const stillBusy = yield* busy(kind);
    if (stillBusy !== null) {
      yield* tools.remove(back);
      return yield* fail(stillBusy);
    }
    if (job !== null) job = { ...job, phase: "switching" };
    const fsError = (cause: unknown) =>
      new MoveError({ reason: "Couldn't switch the folder back.", cause });
    yield* fs.remove(folder).pipe(Effect.mapError(fsError));
    yield* fs.rename(back, folder).pipe(Effect.mapError(fsError));
    if (!(yield* answers(kind, before, folder))) {
      yield* fs.rename(folder, back).pipe(Effect.ignore);
      yield* fs.symlink(target, folder).pipe(Effect.ignore);
      if (MOVERS[kind]!.quiet === "simulators") yield* tools.restartSimulators.pipe(Effect.ignore);
      yield* tools.remove(back).pipe(Effect.ignore);
      return yield* fail(
        `The simulators didn't open from this Mac, so they stay on ${record.driveName}.`,
      );
    }
    yield* keep(records.filter((each) => each.kind !== kind));
    if (job !== null) job = { ...job, phase: "finishing" };
    yield* tools.remove(target);
  });

  /** Runs a move in the background, one at a time, leaving its outcome for the page. */
  const start = Effect.fn("StemcellsMoves.start")(function* (
    first: MoveJob,
    work: Effect.Effect<void, MoveError>,
  ) {
    if (job !== null) return yield* fail("Another move is under way.");
    job = first;
    const finish = Effect.fn("StemcellsMoves.finish")(function* (
      ok: boolean,
      reason: string | null,
    ) {
      last = {
        kind: first.kind,
        direction: first.direction,
        ok,
        reason,
        at: yield* Clock.currentTimeMillis,
      };
      job = null;
    });
    yield* one.withPermit(work).pipe(
      Effect.matchCauseEffect({
        onSuccess: () => finish(true, null),
        onFailure: (cause) =>
          Effect.logWarning("A folder's move to another drive failed", cause).pipe(
            Effect.andThen(
              finish(
                false,
                Option.match(Cause.findErrorOption(cause), {
                  onNone: () => "The move stopped before it finished.",
                  onSome: (error) => error.reason,
                }),
              ),
            ),
          ),
      }),
      FiberSet.run(running),
    );
  });

  const moveAway = Effect.fn("StemcellsMoves.moveAway")(function* (input: {
    readonly kind: MovableKind;
    readonly driveId: string;
  }) {
    const { kind } = input;
    const folder = folderOf(kind);
    if ((yield* linkTarget(folder)) !== null) return yield* fail("It's already on another drive.");
    if (!(yield* isFolder(folder))) return yield* fail("There's nothing here to move.");
    const place = yield* drives.place(input.driveId);
    if (place === null) return yield* fail("That drive isn't connected.");
    if (!canHold(place.filesystem)) {
      return yield* fail(
        `${place.drive.name} isn't formatted for a Mac's folders (APFS or Mac OS Extended).`,
      );
    }
    if (place.owners === false) {
      return yield* fail(
        `${place.drive.name} ignores file ownership, which simulators can't run without. In Finder, choose the drive, File › Get Info, and under Sharing & Permissions turn off “Ignore ownership on this volume”. Then try again.`,
      );
    }
    const machine = yield* drives.machine();
    if (machine === null) return yield* fail("Couldn't tell this Mac's own drive apart.");
    const target = `${place.mount}/${driveRelative(machine, MOVERS[kind]!.path)}`;
    if (yield* exists(target)) {
      return yield* fail(`${place.drive.name} already holds a moved copy. Remove it there first.`);
    }
    if (!(yield* canWriteToward(place.mount, `${place.mount}/Stemcells/${machine}`))) {
      return yield* fail(
        `This Mac's account can't write at the top of ${place.drive.name}: it belongs to another user. In Finder, choose the drive, File › Get Info, click the lock, and under Sharing & Permissions give yourself Read & Write. Then try again.`,
      );
    }
    const reason = yield* busy(kind);
    if (reason !== null) return yield* fail(reason);
    yield* start(
      {
        kind,
        direction: "away",
        driveName: place.drive.name,
        phase: "measuring",
        done: 0,
        total: 0,
      },
      Effect.gen(function* () {
        const total = yield* measured(
          folder,
          place.mount,
          `${place.drive.name} hasn't room for it.`,
        );
        const before = yield* listedBefore(kind);
        yield* awayWork(kind, place, machine, total, before);
      }),
    );
  });

  const moveBack = Effect.fn("StemcellsMoves.moveBack")(function* (kind: MovableKind) {
    const record = recordOf(kind);
    const folder = folderOf(kind);
    const linked = yield* linkTarget(folder);
    if (record === undefined || linked === null) return yield* fail("It isn't on another drive.");
    const place = yield* drives.place(record.driveId);
    if (place === null) return yield* fail(`${record.driveName} isn't connected.`);
    const target = `${place.mount}/${record.relative}`;
    if (!(yield* isFolder(target))) return yield* fail(`It isn't on ${record.driveName} any more.`);
    const reason = yield* busy(kind);
    if (reason !== null) return yield* fail(reason);
    yield* start(
      {
        kind,
        direction: "back",
        driveName: record.driveName,
        phase: "measuring",
        done: 0,
        total: 0,
      },
      Effect.gen(function* () {
        const total = yield* measured(target, home, "This Mac hasn't room for it.");
        const before = yield* listedBefore(kind);
        yield* backWork(kind, record, target, total, before);
      }),
    );
  });

  const startFresh = Effect.fn("StemcellsMoves.startFresh")(function* (kind: MovableKind) {
    const record = recordOf(kind);
    const folder = folderOf(kind);
    if (record === undefined || (yield* linkTarget(folder)) === null) {
      return yield* fail("It isn't on another drive.");
    }
    if ((yield* drives.place(record.driveId)) !== null) {
      return yield* fail(`${record.driveName} is connected: move it back instead.`);
    }
    if (job !== null) return yield* fail("Another move is under way.");
    yield* one.withPermit(
      Effect.gen(function* () {
        yield* fs.remove(folder);
        yield* fs.makeDirectory(folder);
        yield* keep(records.filter((each) => each.kind !== kind));
        if (MOVERS[kind]!.quiet === "simulators")
          yield* tools.restartSimulators.pipe(Effect.ignore);
        last = {
          kind,
          direction: "fresh",
          ok: true,
          reason: null,
          at: yield* Clock.currentTimeMillis,
        };
      }).pipe(
        Effect.mapError((cause) =>
          isMoveError(cause) ? cause : new MoveError({ reason: "Couldn't start it fresh.", cause }),
        ),
      ),
    );
  });

  const status = Effect.fn("StemcellsMoves.status")(function* () {
    const connected = new Set((yield* drives.list()).map((drive) => drive.id));
    const places: Array<MovePlace> = [];
    for (const kind of Object.keys(MOVERS) as Array<MovableKind>) {
      const folder = folderOf(kind);
      const record = recordOf(kind);
      if (record !== undefined && (yield* linkTarget(folder)) !== null) {
        places.push({
          kind,
          where: "away",
          drive: {
            id: record.driveId,
            name: record.driveName,
            connected: connected.has(record.driveId),
          },
          bytes: record.bytes,
        });
      } else {
        places.push({ kind, where: (yield* isFolder(folder)) ? "here" : "none" });
      }
    }
    return { places, job, last } satisfies MovesStatus;
  });

  return {
    service: StemcellsMoves.of({ status, moveAway, moveBack, startFresh }),
    /** Every move under way has ended. */
    settled: FiberSet.awaitEmpty(running),
  };
});

/** The tools as macOS has them. */
const processTools = Effect.gen(function* () {
  const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
  const moveError = (reason: string) => (cause: unknown) => new MoveError({ reason, cause });
  const lowly = (command: string, args: ReadonlyArray<string>) =>
    ChildProcess.make("/usr/bin/nice", ["-n", "10", command, ...args], {
      stdin: "ignore",
      stderr: "ignore",
      forceKillAfter: "5 seconds",
    });
  const string = (command: string, args: ReadonlyArray<string>) =>
    spawner.string(
      ChildProcess.make(command, args, {
        stdin: "ignore",
        stderr: "ignore",
        forceKillAfter: "1 second",
      }),
    );
  const exitOk = (command: ReturnType<typeof lowly>, reason: string) =>
    spawner.exitCode(command).pipe(
      Effect.mapError(moveError(reason)),
      Effect.flatMap((code) => (code === 0 ? Effect.void : fail(reason, `exit ${code}`))),
    );
  return {
    copy: (from, to) => exitOk(lowly("/usr/bin/ditto", [from, to]), "The copy stopped part way."),
    tally: (dir) =>
      Effect.all([
        spawner.string(lowly("/usr/bin/du", ["-s", "-A", "-k", dir])),
        spawner.string(lowly("/bin/sh", ["-c", 'find "$1" | wc -l', "sh", dir])),
      ]).pipe(
        Effect.map(([du, count]) => ({
          kilobytes: Number.parseInt(du, 10),
          files: Number.parseInt(count.trim(), 10),
        })),
        Effect.filterOrFail(
          (tally) => Number.isFinite(tally.kilobytes) && Number.isFinite(tally.files),
          () => new MoveError({ reason: "Couldn't measure the folder." }),
        ),
        Effect.mapError((cause) =>
          isMoveError(cause)
            ? cause
            : new MoveError({ reason: "Couldn't measure the folder.", cause }),
        ),
      ),
    freeBytes: (path) =>
      string("/bin/df", ["-Pk", path]).pipe(
        Effect.timeout("10 seconds"),
        Effect.map(
          (out) => Number(out.trim().split("\n").at(-1)?.split(/\s+/)[3] ?? Number.NaN) * 1024,
        ),
        Effect.filterOrFail(
          Number.isFinite,
          () => new MoveError({ reason: "Couldn't read the free space." }),
        ),
        Effect.mapError((cause) =>
          isMoveError(cause)
            ? cause
            : new MoveError({ reason: "Couldn't read the free space.", cause }),
        ),
      ),
    remove: (dir) => exitOk(lowly("/bin/rm", ["-rf", dir]), "Couldn't remove a folder."),
    bootedSimulators: string("/usr/bin/xcrun", ["simctl", "list", "devices", "booted", "-j"]).pipe(
      Effect.timeout(`${ANSWER_SECONDS} seconds`),
      Effect.flatMap((json) =>
        Effect.try({
          try: () => bootedSimulators(json),
          catch: (cause) => new MoveError({ reason: "Couldn't read simctl's list.", cause }),
        }),
      ),
      Effect.mapError(moveError("The simulator service isn't answering. Try again in a minute.")),
    ),
    simulatorIds: (seconds) =>
      string("/usr/bin/xcrun", ["simctl", "list", "devices", "-j"]).pipe(
        Effect.timeout(`${seconds} seconds`),
        Effect.flatMap((json) =>
          Effect.try({
            try: () => simulatorIds(json),
            catch: (cause) => new MoveError({ reason: "Couldn't read simctl's list.", cause }),
          }),
        ),
        Effect.orElseSucceed(() => null),
      ),
    // The service is loaded in the user domain (gui has none, so kickstart there exits 113 "not
    // found"); in neither, it isn't running and reads the folder afresh when it starts.
    restartSimulators: Effect.gen(function* () {
      const uid = process.getuid?.() ?? 501;
      for (const domain of [`user/${uid}`, `gui/${uid}`]) {
        const restart = ChildProcess.make(
          "/bin/launchctl",
          ["kickstart", "-k", `${domain}/com.apple.CoreSimulator.CoreSimulatorService`],
          { stdin: "ignore", stderr: "ignore", forceKillAfter: "1 second" },
        );
        const code = yield* spawner
          .exitCode(restart)
          .pipe(
            Effect.timeout("20 seconds"),
            Effect.mapError(moveError("Couldn't restart the simulator service.")),
          );
        if (code === 0) return;
        if (code !== NOT_LOADED) {
          return yield* fail("Couldn't restart the simulator service.", `exit ${code}`);
        }
      }
    }),
    xcodeRunning: string("/usr/bin/pgrep", ["-x", "Xcode|xcodebuild"]).pipe(
      Effect.timeout("5 seconds"),
      Effect.map((out) => out.trim().length > 0),
      Effect.orElseSucceed(() => false),
    ),
  } satisfies MoveTools;
});

export const layer = Layer.effect(
  StemcellsMoves,
  Effect.gen(function* () {
    const stateDir = yield* UpstreamDiskWarn.diskStateDir;
    const { service } = yield* makeMoves({
      tools: yield* processTools,
      home: yield* UpstreamDisk.HostHome,
      file: movesFile(stateDir),
      drives: yield* StemcellsDrives.StemcellsDrives,
    });
    return service;
  }),
);
