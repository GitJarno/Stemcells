// @effect-diagnostics nodeBuiltinImport:off -- Reads the commit the build stamped into the app's package.json, once, as the app starts.
/**
 * Where Stemcells' updater sits in upstream's desktop app: in
 * electron-updater's place beneath `DesktopUpdates`, which hears of an
 * update by electron-updater's event names. `updater.contract.test.ts` pins
 * those names; `updates/SourceUpdater.ts` is what stands here.
 */
import * as NodeEvents from "node:events";
import * as NodeFS from "node:fs";
import * as NodePath from "node:path";

import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";

import * as DesktopEnvironment from "../../app/DesktopEnvironment.ts";
import * as ElectronApp from "../../electron/ElectronApp.ts";
import * as ElectronUpdater from "../../electron/ElectronUpdater.ts";

/** What upstream's updater is told, each by the event it listens for. */
export interface Said {
  readonly checking: () => void;
  readonly available: (update: {
    readonly version: string;
    /** electron-updater's notes: a version, and its lines as one string. */
    readonly releaseNotes: ReadonlyArray<{ readonly version: string; readonly note: string }>;
  }) => void;
  readonly upToDate: () => void;
  readonly progress: (percent: number) => void;
  readonly downloaded: (version: string) => void;
}

export interface Host {
  /** The folder apps keep their data in; ours holds the updater's own. */
  readonly appDataDirectory: string;
  /** The running app's resources, inside its bundle. */
  readonly resourcesPath: string;
  /** The commit this app was built from, as its build stamped it; null when it didn't. */
  readonly builtCommit: string | null;
  readonly quit: Effect.Effect<void>;
  readonly said: Said;
  /** The channel upstream last set: "latest" (Stable) or "nightly". */
  readonly channel: () => string;
  /** Whether upstream allows stepping back, as a switch to Stable does. */
  readonly allowDowngrade: () => boolean;
}

/** An updater's three steps; each fails with why, which upstream shows. */
export interface Steps<E> {
  readonly check: Effect.Effect<void, E>;
  readonly download: Effect.Effect<void, E>;
  /** Installs what `download` left, and quits. */
  readonly swap: Effect.Effect<void, E>;
}

/** The app's own package.json, where upstream's build writes the commit it built. */
const decodeStamped = Schema.decodeOption(
  Schema.fromJsonString(Schema.Struct({ t3codeCommitHash: Schema.optional(Schema.String) })),
);

function builtCommitOf(appPath: string): string | null {
  try {
    const stamped = NodeFS.readFileSync(NodePath.join(appPath, "package.json"), "utf8");
    return Option.getOrNull(decodeStamped(stamped))?.t3codeCommitHash ?? null;
  } catch {
    return null;
  }
}

/** Upstream's updater service, run by `steps` instead of electron-updater. */
export const layerOf = <E>(steps: (host: Host) => Steps<E>) =>
  Layer.effect(
    ElectronUpdater.ElectronUpdater,
    Effect.gen(function* () {
      const environment = yield* DesktopEnvironment.DesktopEnvironment;
      const electronApp = yield* ElectronApp.ElectronApp;

      const events = new NodeEvents.EventEmitter();
      let channel = "latest";
      let allowDowngrade = false;

      const { check, download, swap } = steps({
        appDataDirectory: environment.appDataDirectory,
        resourcesPath: environment.resourcesPath,
        builtCommit: builtCommitOf(environment.appPath),
        quit: electronApp.quit,
        said: {
          checking: () => void events.emit("checking-for-update"),
          available: (update) => void events.emit("update-available", update),
          upToDate: () => void events.emit("update-not-available"),
          progress: (percent) => void events.emit("download-progress", { percent }),
          downloaded: (version) => void events.emit("update-downloaded", { version }),
        },
        channel: () => channel,
        allowDowngrade: () => allowDowngrade,
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
        setDisableDifferentialDownload: Effect.fn(
          "stemcells.updates.setDisableDifferentialDownload",
        )(() => Effect.void),
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
    }),
  );
