// @effect-diagnostics nodeBuiltinImport:off -- The updater runs git, the build and the swap, each a Node child process.
/**
 * Takes only electron-updater's place beneath upstream's `DesktopUpdates`, with git and
 * `stemcells/scripts/install-app` (stemcells/tasks/updates.md): check fetches the channel's
 * tip, download stages a build, quitAndInstall swaps it in once the app has quit. Versions are
 * the ones `install-app` stamps, so upstream's channels and its applied-update check hold.
 */
import * as NodeChildProcess from "node:child_process";
import * as NodeEvents from "node:events";
import * as NodeFS from "node:fs";
import * as NodePath from "node:path";
import * as NodeUtil from "node:util";

import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";

import * as DesktopEnvironment from "../../app/DesktopEnvironment.ts";
import * as ElectronApp from "../../electron/ElectronApp.ts";
import * as ElectronUpdater from "../../electron/ElectronUpdater.ts";
import {
  buildPercentOf,
  CHANGE_DATE,
  CHANGE_FORMAT,
  type Change,
  nightlyNotesOf,
  nightlyVersionOf,
  readChanges,
  RELEASE_TAG,
  releaseNotesOf,
} from "./changes.ts";

interface Target {
  readonly sha: string;
  readonly version: string;
  readonly channel: string;
}

class UpdateStepError extends Schema.TaggedError<UpdateStepError>()("StemcellsUpdateStepError", {
  message: Schema.String,
}) {}

/** Written by install-app as it installs: the repository's git folder. */
const SourceFile = Schema.fromJsonString(Schema.Struct({ gitDir: Schema.String }));
/** The build waiting for a restart. */
const StagedFile = Schema.fromJsonString(
  Schema.Struct({ sha: Schema.String, version: Schema.String, channel: Schema.String }),
);
const encodeStaged = Schema.encodeEffect(StagedFile);
/** A package.json: the app's own, where the build stamps its commit, or the desktop's. */
const PackageFile = Schema.fromJsonString(
  Schema.Struct({
    version: Schema.optional(Schema.String),
    t3codeCommitHash: Schema.optional(Schema.String),
  }),
);
const decodePackage = Schema.decodeOption(PackageFile);

const readFile = <A>(schema: Schema.Codec<A, string>, file: string): A | null => {
  try {
    return Option.getOrNull(Schema.decodeOption(schema)(NodeFS.readFileSync(file, "utf8")));
  } catch {
    return null;
  }
};

const execFile = NodeUtil.promisify(NodeChildProcess.execFile);

const messageOf = (cause: unknown): string => {
  const stderr = (cause as { stderr?: unknown }).stderr;
  if (typeof stderr === "string" && stderr.trim() !== "") return stderr.trim();
  return cause instanceof Error ? cause.message : String(cause);
};

/** Resolves once `child` has started, or fails with why it couldn't. */
const started = (child: NodeChildProcess.ChildProcess) =>
  Effect.callback<void, UpdateStepError>((resume) => {
    child.once("spawn", () => resume(Effect.void));
    child.once("error", (error) =>
      resume(Effect.fail(new UpdateStepError({ message: error.message }))),
    );
  });

export const make = Effect.gen(function* () {
  const environment = yield* DesktopEnvironment.DesktopEnvironment;
  const electronApp = yield* ElectronApp.ElectronApp;

  const folder = NodePath.join(environment.appDataDirectory, "sh.stemcells.app", "updates");
  const places = {
    source: NodePath.join(folder, "source.json"),
    worktree: NodePath.join(folder, "source"),
    stage: NodePath.join(folder, "staged"),
    staged: NodePath.join(folder, "staged.json"),
    buildLog: NodePath.join(folder, "build.log"),
    swapLog: NodePath.join(folder, "swap.log"),
  };
  const installApp = NodePath.join(places.worktree, "stemcells/scripts/install-app");
  // The folder this app sits in, which the swap puts the new one in.
  const installedIn = NodePath.dirname(NodePath.resolve(environment.resourcesPath, "../.."));
  const builtCommit =
    readFile(PackageFile, NodePath.join(environment.appPath, "package.json"))?.t3codeCommitHash ??
    null;

  const events = new NodeEvents.EventEmitter();
  let channel = "latest";
  let allowDowngrade = false;
  let pending = Option.none<Target>();

  const run = (command: string, args: ReadonlyArray<string>) =>
    Effect.tryPromise({
      try: async () =>
        (
          await execFile(command, [...args], {
            maxBuffer: 16 * 1024 * 1024,
            timeout: 5 * 60_000,
            // Days in a version are UTC's, as install-app's; a fetch never asks for a password.
            env: { ...process.env, TZ: "UTC", GIT_TERMINAL_PROMPT: "0" },
          })
        ).stdout.trim(),
      catch: (cause) => new UpdateStepError({ message: messageOf(cause) }),
    });

  const gitDir = Effect.suspend(() => {
    const dir = readFile(SourceFile, places.source)?.gitDir;
    if (dir === undefined) {
      return Effect.fail(
        new UpdateStepError({
          message:
            "Install Stemcells once with stemcells/scripts/install-app, and it updates from that repository.",
        }),
      );
    }
    return NodeFS.existsSync(dir)
      ? Effect.succeed(dir)
      : Effect.fail(
          new UpdateStepError({ message: `The repository Stemcells came from is gone (${dir}).` }),
        );
  });
  const git = (args: ReadonlyArray<string>) =>
    gitDir.pipe(Effect.flatMap((dir) => run("git", ["--git-dir", dir, ...args])));

  /** A commit on main's nightly version, and the parts it's made of. */
  const nightlyOf = Effect.fn("stemcells.updates.nightlyOf")(function* (sha: string) {
    const desktop = yield* git(["show", `${sha}:apps/desktop/package.json`]);
    const base = Option.getOrNull(decodePackage(desktop))?.version ?? "0.0.0";
    const day = yield* git(["show", "-s", "--format=%cd", CHANGE_DATE, sha]);
    const count = Number(yield* git(["rev-list", "--count", "--first-parent", sha]));
    return { base, count, version: nightlyVersionOf({ base, day, count }) };
  });

  // Origin's tags land in a namespace of the updater's own: T3's, fetched
  // from upstream, share `refs/tags`.
  const fetch = git([
    "fetch",
    "--quiet",
    "--no-tags",
    "--prune",
    "origin",
    "+refs/heads/main:refs/remotes/origin/main",
    "+refs/tags/v*:refs/stemcells-updates/tags/v*",
  ]);

  /** The channel's tip: main's, or the newest release tag's on origin. */
  const tipOf = Effect.fn("stemcells.updates.tipOf")(function* (on: string) {
    if (on === "nightly") {
      const sha = yield* git(["rev-parse", "refs/remotes/origin/main^{commit}"]);
      const { version } = yield* nightlyOf(sha);
      return Option.some<Target>({ sha, version, channel: on });
    }
    const tags = yield* git([
      "for-each-ref",
      "--sort=-v:refname",
      "--format=%(refname:lstrip=3)",
      "refs/stemcells-updates/tags/",
    ]);
    const tag = tags.split("\n").find((name) => RELEASE_TAG.test(name));
    if (tag === undefined) return Option.none<Target>();
    const sha = yield* git(["rev-parse", `refs/stemcells-updates/tags/${tag}^{commit}`]);
    return Option.some<Target>({ sha, version: tag.slice(1), channel: on });
  });

  const changesTo = (built: string, sha: string) =>
    git([
      "log",
      "--first-parent",
      `--format=${CHANGE_FORMAT}`,
      CHANGE_DATE,
      `${built}..${sha}`,
    ]).pipe(Effect.map(readChanges));

  /** What upstream's updater hears an update holds. */
  const announce = Effect.fn("stemcells.updates.announce")(function* (
    target: Target,
    changes: ReadonlyArray<Change>,
  ) {
    const releaseNotes =
      target.channel === "nightly"
        ? nightlyNotesOf(changes, yield* nightlyOf(target.sha))
        : releaseNotesOf(changes, target.version);
    events.emit("update-available", { version: target.version, releaseNotes });
  });

  /**
   * Drops the staged build and the worktree it came from. Off the main
   * thread: a worktree a build has filled is gigabytes, and deleting it in
   * one synchronous call held the whole app for as long as that took.
   */
  const dropStaged = git(["worktree", "remove", "--force", places.worktree]).pipe(
    Effect.ignore,
    Effect.andThen(
      Effect.promise(() =>
        Promise.all([
          NodeFS.promises.rm(places.worktree, { recursive: true, force: true }),
          NodeFS.promises.rm(places.stage, { recursive: true, force: true }),
          NodeFS.promises.rm(places.staged, { force: true }),
        ]),
      ),
    ),
  );

  /**
   * Empties the worktree of what the build made (dependencies, artifacts),
   * about 4 GB, once the app is staged. The swap needs only its tracked
   * install-app. Only in a checkout of its own: `git -C` on a folder without
   * one would clean whatever repository holds it.
   */
  const emptyBuild = Effect.suspend(() =>
    NodeFS.existsSync(NodePath.join(places.worktree, ".git"))
      ? run("git", ["-C", places.worktree, "clean", "-ffdxq"]).pipe(Effect.ignore)
      : Effect.void,
  );

  const check = Effect.gen(function* () {
    events.emit("checking-for-update");
    if (builtCommit === null || builtCommit === "unknown") {
      return yield* new UpdateStepError({
        message: "This build doesn't say which commit it was made from.",
      });
    }
    yield* fetch;
    const built = yield* git(["rev-parse", `${builtCommit}^{commit}`]);
    const on = channel;

    const tip = yield* tipOf(on);
    const changes = Option.isSome(tip) ? yield* changesTo(built, tip.value.sha) : [];
    const staged = readFile(StagedFile, places.staged);
    // Stable steps back to its release when someone switches to it (upstream
    // allows a downgrade then, and its build waits for the restart); Nightly
    // never takes a build back to main.
    const steppingBack =
      Option.isSome(tip) &&
      tip.value.sha !== built &&
      on === "latest" &&
      (allowDowngrade || staged?.sha === tip.value.sha);
    const offered = changes.length > 0 || steppingBack ? tip : Option.none<Target>();
    // A built update waits for its restart only while it's still the tip: a
    // newer main replaces it, so the update offered is always the newest.
    const ready =
      staged !== null &&
      Option.isSome(offered) &&
      staged.sha === offered.value.sha &&
      staged.channel === on &&
      NodeFS.existsSync(places.stage);
    if (staged !== null && !ready) yield* dropStaged;
    if (Option.isNone(offered)) {
      pending = Option.none();
      events.emit("update-not-available");
      return;
    }
    pending = offered;
    yield* announce(offered.value, changes);
    if (ready) events.emit("update-downloaded", { version: offered.value.version });
  });

  /** Builds `target` with its own install-app, in the updater's worktree. */
  const build = Effect.fn("stemcells.updates.build")(function* (target: Target) {
    yield* dropStaged;
    yield* git(["worktree", "add", "--detach", "--force", places.worktree, target.sha]);
    const log = yield* Effect.sync(() => NodeFS.openSync(places.buildLog, "w"));
    let logOpen = true;
    const child = NodeChildProcess.spawn(
      installApp,
      ["--stage", places.stage, "--version", target.version],
      {
        cwd: places.worktree,
        // Its own process group, so stopping the build stops pnpm and
        // electron-builder under it too.
        detached: true,
        stdio: ["ignore", "pipe", "pipe"],
        env: { ...process.env, TZ: "UTC" },
      },
    );
    let percent = 0;
    const tail: string[] = [];
    const read = (chunk: Buffer) => {
      if (logOpen) NodeFS.writeSync(log, chunk);
      for (const line of chunk.toString("utf8").split("\n")) {
        if (line.trim() === "") continue;
        tail.push(line);
        if (tail.length > 20) tail.shift();
        const next = buildPercentOf(line, percent);
        if (next !== percent) events.emit("download-progress", { percent: next });
        percent = next;
      }
    };
    child.stdout?.on("data", read);
    child.stderr?.on("data", read);
    yield* Effect.callback<void, UpdateStepError>((resume) => {
      child.once("error", (error) =>
        resume(Effect.fail(new UpdateStepError({ message: error.message }))),
      );
      child.once("close", (code) => {
        if (code === 0) return resume(Effect.void);
        const said = tail.filter((line) => line.startsWith("install-app:")).join(" ");
        resume(
          Effect.fail(
            new UpdateStepError({ message: said || `The build stopped (exit ${code}).` }),
          ),
        );
      });
      // The app quitting mid-build ends it; the next one starts over.
      return Effect.try(() => {
        if (child.pid !== undefined && child.exitCode === null) process.kill(-child.pid, "SIGTERM");
      }).pipe(Effect.ignore);
    }).pipe(
      Effect.ensuring(
        Effect.sync(() => {
          logOpen = false;
          NodeFS.closeSync(log);
        }),
      ),
      Effect.tapError(() => dropStaged),
    );
    const staged = yield* encodeStaged(target).pipe(
      Effect.mapError((cause) => new UpdateStepError({ message: cause.message })),
    );
    yield* Effect.sync(() => NodeFS.writeFileSync(places.staged, staged));
    yield* emptyBuild;
  });

  const download = Effect.gen(function* () {
    if (Option.isNone(pending)) {
      return yield* new UpdateStepError({ message: "There's no update to build." });
    }
    const target = pending.value;
    const staged = readFile(StagedFile, places.staged);
    if (staged?.sha !== target.sha || !NodeFS.existsSync(places.stage)) yield* build(target);
    events.emit("update-downloaded", { version: target.version });
  });

  /**
   * Hands the swap to install-app, on its own, then quits: it puts the new
   * app in once this one has gone, and opens whichever app it ends with. A
   * notification says if the update didn't go in.
   */
  const swap = Effect.gen(function* () {
    const staged = readFile(StagedFile, places.staged);
    if (staged === null || !NodeFS.existsSync(places.stage)) {
      return yield* new UpdateStepError({ message: "The built update is gone." });
    }
    // Main may have moved since the last check; offline, the last fetch's tip stands.
    yield* fetch.pipe(Effect.ignore);
    const tip = yield* tipOf(staged.channel);
    if (Option.isNone(tip) || tip.value.sha !== staged.sha) {
      yield* dropStaged;
      return yield* new UpdateStepError({
        message: "Main moved on while the update waited. The next check offers the newest.",
      });
    }
    const log = NodeFS.openSync(places.swapLog, "a");
    const child = yield* Effect.try({
      try: () =>
        NodeChildProcess.spawn(installApp, ["--swap-in", places.stage, "--to", installedIn], {
          cwd: places.worktree,
          detached: true,
          stdio: ["ignore", log, log],
          env: { ...process.env, STEMCELLS_INSTALL_ALONE: "1" },
        }),
      catch: (cause) => new UpdateStepError({ message: messageOf(cause) }),
    }).pipe(Effect.ensuring(Effect.sync(() => NodeFS.closeSync(log))));
    yield* started(child);
    child.unref();
    yield* electronApp.quit;
  });

  return ElectronUpdater.ElectronUpdater.of({
    // The feed is the repository install-app recorded; upstream's mock feed
    // has no place here.
    setFeedURL: Effect.fn("stemcells.updates.setFeedURL")(() => Effect.void),
    setAutoDownload: Effect.fn("stemcells.updates.setAutoDownload")(() => Effect.void),
    setAutoInstallOnAppQuit: Effect.fn("stemcells.updates.setAutoInstallOnAppQuit")(
      () => Effect.void,
    ),
    setChannel: Effect.fn("stemcells.updates.setChannel")((next) =>
      Effect.sync(() => {
        channel = next;
      }),
    ),
    setAllowPrerelease: Effect.fn("stemcells.updates.setAllowPrerelease")(() => Effect.void),
    allowDowngrade: Effect.sync(() => allowDowngrade),
    setAllowDowngrade: Effect.fn("stemcells.updates.setAllowDowngrade")((value) =>
      Effect.sync(() => {
        allowDowngrade = value;
      }),
    ),
    setFullChangelog: Effect.fn("stemcells.updates.setFullChangelog")(() => Effect.void),
    setDisableDifferentialDownload: Effect.fn("stemcells.updates.setDisableDifferentialDownload")(
      () => Effect.void,
    ),
    checkForUpdates: check.pipe(
      Effect.mapError(
        (cause) => new ElectronUpdater.ElectronUpdaterCheckForUpdatesError({ channel, cause }),
      ),
      Effect.withSpan("stemcells.updates.check"),
    ),
    downloadUpdate: download.pipe(
      Effect.mapError(
        (cause) => new ElectronUpdater.ElectronUpdaterDownloadUpdateError({ channel, cause }),
      ),
      Effect.withSpan("stemcells.updates.download"),
    ),
    quitAndInstall: Effect.fn("stemcells.updates.swap")(({ isSilent, isForceRunAfter }) =>
      swap.pipe(
        Effect.mapError(
          (cause) =>
            new ElectronUpdater.ElectronUpdaterQuitAndInstallError({
              channel,
              isSilent,
              isForceRunAfter,
              cause,
            }),
        ),
      ),
    ),
    on: Effect.fn("stemcells.updates.on")(function (eventName, listener) {
      const untyped = listener as unknown as (...args: Array<unknown>) => void;
      return Effect.acquireRelease(
        Effect.sync(() => {
          events.on(eventName, untyped);
        }),
        () =>
          Effect.sync(() => {
            events.removeListener(eventName, untyped);
          }),
      ).pipe(Effect.asVoid);
    }),
  });
});

export const layer = Layer.effect(ElectronUpdater.ElectronUpdater, make);
