// @effect-diagnostics nodeBuiltinImport:off -- The fixture is a real git repository on disk.
import * as NodeChildProcess from "node:child_process";
import * as NodeFS from "node:fs";
import * as NodeOS from "node:os";
import * as NodePath from "node:path";

import { assert, describe, it } from "@effect/vitest";
import * as NodeServices from "@effect/platform-node/NodeServices";
import type { DesktopUpdateState } from "@t3tools/contracts";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import type * as Scope from "effect/Scope";
import * as Stream from "effect/Stream";

import * as DesktopConfig from "../../app/DesktopConfig.ts";
import * as DesktopEnvironment from "../../app/DesktopEnvironment.ts";
import * as DesktopState from "../../app/DesktopState.ts";
import * as DesktopBackendPool from "../../backend/DesktopBackendPool.ts";
import * as ElectronApp from "../../electron/ElectronApp.ts";
import * as ElectronWindow from "../../electron/ElectronWindow.ts";
import * as DesktopAppSettings from "../../settings/DesktopAppSettings.ts";
import * as DesktopUpdates from "../../updates/DesktopUpdates.ts";
import * as SourceUpdater from "./SourceUpdater.ts";

const git = (cwd: string, ...args: string[]) =>
  NodeChildProcess.execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    env: { ...process.env, TZ: "UTC" },
  }).trim();

// Stands in for stemcells/scripts/install-app: says the steps the real one
// says, and leaves what each mode leaves.
const FAKE_INSTALL_APP = `#!/bin/sh
case "$1" in
  --stage)
    echo "==> Installing dependencies"
    echo "[desktop-artifact] Staging release app..."
    mkdir -p node_modules/dep release
    echo "module.exports = 1" > node_modules/dep/index.js
    echo "dmg" > release/Stemcells.dmg
    mkdir -p "$2/Stemcells.app"
    echo "$4" > "$2/Stemcells.app/version"
    echo "Stemcells is built at $2/Stemcells.app." ;;
  --swap-in)
    echo "$4 $STEMCELLS_INSTALL_ALONE" > "$2/../swapped" ;;
esac
`;

interface Fixture {
  readonly root: string;
  /** The commit the running app was built from. */
  readonly built: string;
  readonly work: string;
  readonly installedFrom: string;
  readonly home: string;
  readonly t3Home: string;
  readonly appPath: string;
  readonly applications: string;
  readonly updates: string;
}

/**
 * The repository on GitHub (`work`), the clone Stemcells was installed from
 * at its first commit, and the app built from it, a nightly.
 */
function makeFixture({
  withSource = true,
  builtFrom = "first",
}: { readonly withSource?: boolean; readonly builtFrom?: "first" | "newest" } = {}): Fixture {
  const root = NodeFS.realpathSync(
    NodeFS.mkdtempSync(NodePath.join(NodeOS.tmpdir(), "stemcells-updates-")),
  );
  const work = NodePath.join(root, "work");
  NodeFS.mkdirSync(NodePath.join(work, "apps/desktop"), { recursive: true });
  git(work, "init", "-q", "-b", "main");
  git(work, "config", "user.email", "test@example.com");
  git(work, "config", "user.name", "Test");
  NodeFS.writeFileSync(NodePath.join(work, "apps/desktop/package.json"), '{ "version": "0.1.1" }');
  git(work, "add", ".");
  git(work, "commit", "-q", "-m", "The first one (#1)");
  const installedFrom = NodePath.join(root, "installed-from");
  git(root, "clone", "-q", work, installedFrom);
  const first = git(work, "rev-parse", "HEAD");

  const script = NodePath.join(work, "stemcells/scripts/install-app");
  NodeFS.mkdirSync(NodePath.dirname(script), { recursive: true });
  NodeFS.writeFileSync(script, FAKE_INSTALL_APP, { mode: 0o755 });
  git(work, "add", ".");
  git(work, "commit", "-q", "-m", "A change (#2)");
  git(
    work,
    "commit",
    "-q",
    "--allow-empty",
    "-m",
    "Merge pull request #3 from someone/sync/upstream-abc123",
  );
  git(work, "commit", "-q", "--allow-empty", "-m", "The newest (#4)");
  const built = builtFrom === "first" ? first : git(work, "rev-parse", "HEAD");

  const home = NodePath.join(root, "home");
  const updates = NodePath.join(home, "Library/Application Support/sh.stemcells.app/updates");
  NodeFS.mkdirSync(updates, { recursive: true });
  if (withSource) {
    NodeFS.writeFileSync(
      NodePath.join(updates, "source.json"),
      JSON.stringify({ gitDir: NodePath.join(installedFrom, ".git") }),
    );
  }
  const applications = NodePath.join(root, "Applications");
  const resources = NodePath.join(applications, "Stemcells.app/Contents/Resources");
  NodeFS.mkdirSync(resources, { recursive: true });
  // What install-app's build names as its feed.
  NodeFS.writeFileSync(
    NodePath.join(resources, "app-update.yml"),
    "owner: someone\nrepo: Stemcells\nprovider: github\n",
  );
  const appPath = NodePath.join(resources, "app");
  NodeFS.mkdirSync(appPath);
  NodeFS.writeFileSync(
    NodePath.join(appPath, "package.json"),
    JSON.stringify({ t3codeCommitHash: built.slice(0, 12) }),
  );
  return {
    root,
    built,
    work,
    installedFrom,
    home,
    t3Home: NodePath.join(root, "t3"),
    appPath,
    applications,
    updates,
  };
}

const nightlyOf = (fixture: Fixture, sha: string) => {
  const day = git(fixture.work, "show", "-s", "--format=%cd", "--date=format-local:%Y%m%d", sha);
  const count = git(fixture.work, "rev-list", "--count", "--first-parent", sha);
  return `0.1.1-nightly.${day}.${count}`;
};

function layerFor(fixture: Fixture, quits: { count: number }) {
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
    whenReady: Effect.void,
    requestSingleInstanceLock: Effect.succeed(true),
    quit: Effect.sync(() => {
      quits.count += 1;
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
    ...DesktopAppSettings.resolveDefaultDesktopSettings(nightlyOf(fixture, fixture.built)),
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
  const layerConfig = DesktopConfig.layerTest({ T3CODE_HOME: fixture.t3Home });
  const layerEnvironment = DesktopEnvironment.layer({
    dirname: "/repo/apps/desktop/src",
    homeDirectory: fixture.home,
    platform: "darwin",
    processArch: "arm64",
    appVersion: nightlyOf(fixture, fixture.built),
    appPath: fixture.appPath,
    isPackaged: true,
    resourcesPath: NodePath.dirname(fixture.appPath),
    runningUnderArm64Translation: false,
  }).pipe(Layer.provide(Layer.mergeAll(NodeServices.layer, layerConfig)));
  return DesktopUpdates.layer.pipe(
    Layer.provide(SourceUpdater.layer),
    Layer.provide(
      Layer.mergeAll(
        layerWindow,
        layerApp,
        layerSettings,
        layerBackend,
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
const reaching = <A, E, R>(status: DesktopUpdateState["status"], action: Effect.Effect<A, E, R>) =>
  Effect.gen(function* () {
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

/** Resolves once `file` exists: the detached swap writes it on its own. */
const appears = (file: string) =>
  Effect.callback<void>((resume) => {
    if (NodeFS.existsSync(file)) return resume(Effect.void);
    const watcher = NodeFS.watch(NodePath.dirname(file), () => {
      if (NodeFS.existsSync(file)) resume(Effect.void);
    });
    return Effect.sync(() => watcher.close());
  });

const withFixture = <A, E>(
  options: Parameters<typeof makeFixture>[0],
  use: (
    fixture: Fixture,
    quits: { readonly count: number },
  ) => Effect.Effect<A, E, DesktopUpdates.DesktopUpdates | Scope.Scope>,
) =>
  Effect.acquireUseRelease(
    Effect.sync(() => makeFixture(options)),
    (fixture) => {
      const quits = { count: 0 };
      return Effect.scoped(use(fixture, quits)).pipe(
        Effect.provide(layerFor(fixture, quits)),
        Effect.orDie,
      );
    },
    (fixture) => Effect.sync(() => NodeFS.rmSync(fixture.root, { recursive: true, force: true })),
  );

const desktopSource = NodePath.resolve(import.meta.dirname, "../..");

/** The desktop's own modules, by path under `src`. */
const desktopModules = (folder = desktopSource): string[] =>
  NodeFS.readdirSync(folder, { withFileTypes: true }).flatMap((entry) => {
    const path = NodePath.join(folder, entry.name);
    if (entry.isDirectory()) return desktopModules(path);
    return /\.tsx?$/u.test(entry.name) && !/\.test\.tsx?$/u.test(entry.name)
      ? [NodePath.relative(desktopSource, path)]
      : [];
  });

describe("Stemcells' updates, upstream's updater on the repository", () => {
  // A build names origin as its feed (install-app), which electron-updater
  // would reach out to read: upstream's updater is its one user, and runs
  // on ours.
  it("leaves electron-updater no one to fetch for", () => {
    const users = desktopModules().filter((file) =>
      /from "(?:\.\.?\/)+electron\/ElectronUpdater\.ts"/u.test(
        NodeFS.readFileSync(NodePath.join(desktopSource, file), "utf8"),
      ),
    );
    assert.deepEqual(users.toSorted(), [
      "main.ts",
      "stemcells/updates/SourceUpdater.ts",
      "updates/DesktopUpdates.ts",
      "updates/updatesTestHarness.ts",
    ]);
    const main = NodeFS.readFileSync(NodePath.join(desktopSource, "main.ts"), "utf8");
    assert.include(main, "DesktopUpdates.layer.pipe(Layer.provide(StemcellsUpdater.layer))");
  });

  it.live("lists the merged pull requests, builds them beside the app, and swaps as it quits", () =>
    withFixture({}, (fixture, quits) =>
      Effect.gen(function* () {
        const updates = yield* DesktopUpdates.DesktopUpdates;
        yield* updates.configure;
        // A main build's version puts it on Nightly.
        const configured = yield* updates.getState;
        assert.equal(configured.status, "idle");
        assert.equal(configured.channel, "nightly");

        const available = yield* reaching("available", updates.check("test"));
        const tip = nightlyOf(fixture, "HEAD");
        assert.equal(available.availableVersion, tip);
        // One day's merges: one nightly, as upstream's notes show T3's.
        assert.deepEqual(available.releaseNotes, [
          {
            version: tip,
            items: ["The newest (#4)", "T3's latest work (#3)", "A change (#2)"],
            totalItems: 3,
          },
        ]);

        const downloaded = yield* reaching("downloaded", updates.download);
        assert.equal(downloaded.downloadedVersion, tip);
        const built = NodePath.join(fixture.updates, "staged/Stemcells.app/version");
        assert.equal(NodeFS.readFileSync(built, "utf8").trim(), tip);
        // What the build made leaves the worktree once the app is staged;
        // the install-app the swap runs stays.
        const worktree = NodePath.join(fixture.updates, "source");
        assert.isFalse(NodeFS.existsSync(NodePath.join(worktree, "node_modules")));
        assert.isFalse(NodeFS.existsSync(NodePath.join(worktree, "release")));
        assert.isTrue(NodeFS.existsSync(NodePath.join(worktree, "stemcells/scripts/install-app")));

        const installed = yield* updates.install;
        assert.isTrue(installed.accepted);
        assert.equal(quits.count, 1);
        // The swap runs on its own, into the folder the app sits in, and
        // says how it went with no one watching.
        const swapped = NodePath.join(fixture.updates, "swapped");
        yield* appears(swapped);
        assert.equal(NodeFS.readFileSync(swapped, "utf8").trim(), `${fixture.applications} 1`);
      }),
    ),
  );

  it.live("keeps a finished build for its restart while main moves on", () =>
    withFixture({}, (fixture) =>
      Effect.gen(function* () {
        const updates = yield* DesktopUpdates.DesktopUpdates;
        yield* updates.configure;
        yield* reaching("available", updates.check("test"));
        const built = yield* reaching("downloaded", updates.download);

        git(fixture.work, "commit", "-q", "--allow-empty", "-m", "Merged after the build (#5)");
        const later = yield* reaching("downloaded", updates.check("poll"));
        assert.equal(later.downloadedVersion, built.downloadedVersion);
        assert.equal(later.releaseNotes.flatMap((note) => note.items).length, 3);
      }),
    ),
  );

  it.live("follows origin's newest release on Stable, and not T3's tags", () =>
    withFixture({}, (fixture) =>
      Effect.gen(function* () {
        git(fixture.work, "tag", "v0.2.0", "HEAD~1");
        // T3's tags reach the same repository from upstream, and aren't ours.
        git(fixture.installedFrom, "tag", "v9.0.0", "HEAD");
        const updates = yield* DesktopUpdates.DesktopUpdates;
        yield* updates.configure;

        const stable = yield* reaching("available", updates.setChannel("latest"));
        assert.equal(stable.channel, "latest");
        assert.equal(stable.availableVersion, "0.2.0");
        assert.deepEqual(
          stable.releaseNotes.flatMap((note) => note.items),
          ["T3's latest work (#3)", "A change (#2)"],
        );
      }),
    ),
  );

  it.live(
    "keeps the step back to a release, once someone switches to Stable, for its restart",
    () =>
      withFixture({ builtFrom: "newest" }, (fixture) =>
        Effect.gen(function* () {
          git(fixture.work, "tag", "v0.1.0", "HEAD~2");
          const updates = yield* DesktopUpdates.DesktopUpdates;
          yield* updates.configure;
          const stable = yield* reaching("available", updates.setChannel("latest"));
          assert.equal(stable.availableVersion, "0.1.0");
          yield* reaching("downloaded", updates.download);

          // Upstream allows the step back only for the switch's own check.
          const later = yield* reaching("downloaded", updates.check("poll"));
          assert.equal(later.downloadedVersion, "0.1.0");
          assert.isTrue(NodeFS.existsSync(NodePath.join(fixture.updates, "staged/Stemcells.app")));
        }),
      ),
  );

  it.live("says why it can't check until install-app records where it came from", () =>
    withFixture({ withSource: false }, () =>
      Effect.gen(function* () {
        const updates = yield* DesktopUpdates.DesktopUpdates;
        yield* updates.configure;
        const failed = yield* reaching("error", updates.check("test"));
        assert.equal(failed.errorContext, "check");
      }),
    ),
  );
});
