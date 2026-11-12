// @effect-diagnostics nodeBuiltinImport:off -- The app's resources sit beside its code, by path.
/**
 * Upstream's real `DesktopUpdates` over an updater of ours (`updater.ts`),
 * with the rest of its desktop app stood in, for the updater's test.
 */
import * as NodePath from "node:path";

import * as NodeServices from "@effect/platform-node/NodeServices";
import type { DesktopUpdateState } from "@t3tools/contracts";
import { assert } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Stream from "effect/Stream";

import * as DesktopConfig from "../../app/DesktopConfig.ts";
import * as DesktopEnvironment from "../../app/DesktopEnvironment.ts";
import * as DesktopState from "../../app/DesktopState.ts";
import * as DesktopBackendPool from "../../backend/DesktopBackendPool.ts";
import * as ElectronApp from "../../electron/ElectronApp.ts";
import * as ElectronWindow from "../../electron/ElectronWindow.ts";
import * as DesktopSshEnvironment from "../../ssh/DesktopSshEnvironment.ts";
import * as DesktopAppSettings from "../../settings/DesktopAppSettings.ts";
import * as DesktopUpdatePolicy from "../../updates/DesktopUpdatePolicy.ts";
import * as DesktopUpdates from "../../updates/DesktopUpdates.ts";
import type { layerOf } from "./updater.ts";

/** Upstream's updater, as Settings and the app's menu drive it. */
export const Updates = DesktopUpdates.DesktopUpdates;
export type Updates = DesktopUpdates.DesktopUpdates;

/**
 * Upstream's updater on `updater`, in a packaged app of `version` at
 * `appPath`, on a Mac whose home is `home`.
 */
export function updatesLayer(input: {
  readonly updater: ReturnType<typeof layerOf>;
  readonly version: string;
  readonly appPath: string;
  readonly home: string;
  readonly t3Home: string;
  /** Called when the app is told to quit. */
  readonly quit: () => void;
}) {
  const layerWindow = Layer.succeed(ElectronWindow.ElectronWindow, {
    create: () => Effect.die("unexpected BrowserWindow creation"),
    main: Effect.succeedNone,
    currentMainOrFirst: Effect.succeedNone,
    focusedMainOrFirst: Effect.succeedNone,
    setMain: () => Effect.void,
    clearMain: () => Effect.void,
    prepareReveal: () => Effect.succeed(false),
    reveal: () => Effect.void,
    sendAll: () => Effect.void,
    destroyAll: Effect.void,
    syncAllAppearance: () => Effect.void,
  } satisfies ElectronWindow.ElectronWindow["Service"]);
  const layerApp = Layer.succeed(ElectronApp.ElectronApp, {
    metadata: Effect.die("unexpected metadata read"),
    name: Effect.succeed("Stemcells"),
    systemLocale: Effect.succeed("en-US"),
    preferredSystemLanguages: Effect.succeed(["en-US"]),
    whenReady: Effect.void,
    requestSingleInstanceLock: Effect.succeed(true),
    quit: Effect.sync(() => {
      input.quit();
    }),
    exit: () => Effect.void,
    relaunch: () => Effect.void,
    setPath: () => Effect.void,
    setName: () => Effect.void,
    setAboutPanelOptions: () => Effect.void,
    setAppUserModelId: () => Effect.void,
    getAppMetrics: Effect.succeed([]),
    setAsDefaultProtocolClient: () => Effect.succeed(true),
    setDesktopName: () => Effect.void,
    setDockIcon: () => Effect.void,
    appendCommandLineSwitch: () => Effect.void,
    onBeforeQuitForUpdate: () => Effect.void,
    removeCommandLineSwitch: () => Effect.void,
    on: () => Effect.void,
  } satisfies ElectronApp.ElectronApp["Service"]);
  let settings: DesktopAppSettings.DesktopSettings = {
    ...DesktopAppSettings.resolveDefaultDesktopSettings(input.version),
  };
  const layerSettings = Layer.succeed(DesktopAppSettings.DesktopAppSettings, {
    get: Effect.sync(() => settings),
    load: Effect.sync(() => settings),
    setMainWindowBounds: () => Effect.die("unexpected"),
    setServerExposureMode: () => Effect.die("unexpected"),
    setTailscaleServe: () => Effect.die("unexpected"),
    setUpdateChannel: (channel) =>
      Effect.sync(() => {
        settings = { ...settings, updateChannel: channel, updateChannelConfiguredByUser: true };
        return { settings, changed: true };
      }),
    setWslBackendEnabled: () => Effect.die("unexpected"),
    setWslDistro: () => Effect.die("unexpected"),
    setLocalEnvironmentEnabled: () => Effect.die("unexpected"),
    setWslOnly: () => Effect.die("unexpected"),
    applyWslWindowsFallback: Effect.die("unexpected"),
    applyWslWindowsFallbackInMemory: Effect.die("unexpected"),
  } satisfies DesktopAppSettings.DesktopAppSettings["Service"]);
  let backendRunning = true;
  const layerBackend = DesktopBackendPool.layerTest([
    {
      id: DesktopBackendPool.PRIMARY_INSTANCE_ID,
      label: Effect.succeed("Local"),
      start: Effect.sync(() => {
        backendRunning = true;
      }),
      stop: () =>
        Effect.sync(() => {
          backendRunning = false;
        }),
      currentConfig: Effect.succeedNone,
      snapshot: Effect.sync(() => ({
        desiredRunning: backendRunning,
        ready: backendRunning,
        activePid: Option.none(),
        restartAttempt: 0,
        restartScheduled: false,
      })),
      waitForReady: () => Effect.succeed(true),
    },
  ]);
  const layerConfig = DesktopConfig.layerTest({ T3CODE_HOME: input.t3Home });
  const layerEnvironment = DesktopEnvironment.layer({
    dirname: "/repo/apps/desktop/src",
    homeDirectory: input.home,
    platform: "darwin",
    processArch: "arm64",
    appVersion: input.version,
    appPath: input.appPath,
    isPackaged: true,
    resourcesPath: NodePath.dirname(input.appPath),
    runningUnderArm64Translation: false,
  }).pipe(Layer.provide(Layer.mergeAll(NodeServices.layer, layerConfig)));
  // Upstream's install closes SSH port forwards first; the lab's app has none.
  const layerSsh = Layer.succeed(DesktopSshEnvironment.DesktopSshEnvironment, {
    discoverHosts: () => Effect.die("unexpected"),
    resolveHost: () => Effect.die("unexpected"),
    ensureEnvironment: () => Effect.die("unexpected"),
    disconnectEnvironment: () => Effect.die("unexpected"),
    closeAllTunnels: Effect.void,
  } satisfies DesktopSshEnvironment.DesktopSshEnvironment["Service"]);
  return DesktopUpdates.layer.pipe(
    Layer.provide(input.updater),
    Layer.provide(
      Layer.mergeAll(
        DesktopUpdatePolicy.layerTest(),
        layerWindow,
        layerApp,
        layerSettings,
        layerBackend,
        layerSsh,
        DesktopState.layer,
        layerConfig,
        layerEnvironment,
        NodeServices.layer,
      ),
    ),
  );
}

/**
 * Runs `action`, then the first state upstream's updater publishes with
 * `status`, or with an error, which fails the test with its message.
 */
export const reaching = Effect.fn("reaching")(function* <A, E, R>(
  status: DesktopUpdateState["status"],
  action: Effect.Effect<A, E, R>,
) {
  const updates = yield* DesktopUpdates.DesktopUpdates;
  const { changes } = yield* updates.subscribe;
  const reached = yield* changes.pipe(
    Stream.filter((state) => state.status === status || state.status === "error"),
    Stream.runHead,
    Effect.forkScoped,
  );
  yield* action;
  const state = Option.getOrThrow(yield* Fiber.join(reached));
  assert.equal(state.status, status, state.message ?? undefined);
  return state;
});
