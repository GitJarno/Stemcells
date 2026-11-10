// @effect-diagnostics nodeBuiltinImport:off -- The fixture is a real git repository on disk.
import * as NodeChildProcess from "node:child_process";
import * as NodeFS from "node:fs";
import * as NodeOS from "node:os";
import * as NodePath from "node:path";

import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import type * as Scope from "effect/Scope";

import { reaching, Updates, updatesLayer } from "../upstream/updater.fixture.ts";
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

// What Settings' track switch hands the updater (`UpdateTrackSwitchDialog` substitute): any
// release of our own source's track, where upstream's switch names T3's npm release.
const ANY_RELEASE = { minimumVersion: "0.0.0" };

const nightlyOf = (fixture: Fixture, sha: string) => {
  const day = git(fixture.work, "show", "-s", "--format=%cd", "--date=format-local:%Y%m%d", sha);
  const count = git(fixture.work, "rev-list", "--count", "--first-parent", sha);
  return `0.1.1-nightly.${day}.${count}`;
};

const layerFor = (fixture: Fixture, quits: { count: number }) =>
  updatesLayer({
    updater: SourceUpdater.layer,
    version: nightlyOf(fixture, fixture.built),
    appPath: fixture.appPath,
    home: fixture.home,
    t3Home: fixture.t3Home,
    quit: () => {
      quits.count += 1;
    },
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
  ) => Effect.Effect<A, E, Updates | Scope.Scope>,
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

describe("Stemcells' updates, upstream's updater on the repository", () => {
  it.live("lists the merged pull requests, builds them beside the app, and swaps as it quits", () =>
    withFixture({}, (fixture, quits) =>
      Effect.gen(function* () {
        const updates = yield* Updates;
        yield* updates.configure;
        // A main build's version puts it on Nightly.
        const configured = yield* updates.getState;
        assert.equal(configured.status, "idle");
        assert.equal(configured.channel, "nightly");

        const available = yield* reaching("available", updates.check("test"));
        const tip = nightlyOf(fixture, "HEAD");
        assert.equal(available.availableVersion, tip);
        // One day's merges: one nightly, as upstream's notes show T3's.
        // Upstream dates a nightly's notes by the day in its version.
        const day = tip.replace(/^.*-nightly\.(\d{4})(\d{2})(\d{2})\..*$/, "$1-$2-$3");
        assert.deepEqual(available.releaseNotes, [
          {
            version: tip,
            items: ["The newest (#4)", "T3's latest work (#3)", "A change (#2)"],
            totalItems: 3,
            releasedAt: day,
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

  it.live("offers the newest once main moves past a finished build, never the older one", () =>
    withFixture({}, (fixture) =>
      Effect.gen(function* () {
        const updates = yield* Updates;
        yield* updates.configure;
        yield* reaching("available", updates.check("test"));
        yield* reaching("downloaded", updates.download);

        git(fixture.work, "commit", "-q", "--allow-empty", "-m", "Merged after the build (#5)");
        const later = yield* reaching("available", updates.check("poll"));
        assert.equal(later.availableVersion, nightlyOf(fixture, "HEAD"));
        assert.isNull(later.downloadedVersion);
        assert.equal(later.releaseNotes.flatMap((note) => note.items).length, 4);
        assert.isFalse(NodeFS.existsSync(NodePath.join(fixture.updates, "staged")));
      }),
    ),
  );

  it.live("never swaps in a build main moved past since the last check", () =>
    withFixture({}, (fixture, quits) =>
      Effect.gen(function* () {
        const updates = yield* Updates;
        yield* updates.configure;
        yield* reaching("available", updates.check("test"));
        yield* reaching("downloaded", updates.download);

        git(fixture.work, "commit", "-q", "--allow-empty", "-m", "Merged while it waited (#5)");
        const installed = yield* updates.install;
        assert.equal(installed.state.errorContext, "install");
        assert.equal(quits.count, 0);
        assert.isFalse(NodeFS.existsSync(NodePath.join(fixture.updates, "staged")));
        const next = yield* reaching("available", updates.check("poll"));
        assert.equal(next.availableVersion, nightlyOf(fixture, "HEAD"));
      }),
    ),
  );

  it.live("follows origin's newest release on Stable, and not T3's tags", () =>
    withFixture({}, (fixture) =>
      Effect.gen(function* () {
        git(fixture.work, "tag", "v0.2.0", "HEAD~1");
        // T3's tags reach the same repository from upstream, and aren't ours.
        git(fixture.installedFrom, "tag", "v9.0.0", "HEAD");
        const updates = yield* Updates;
        yield* updates.configure;

        const stable = yield* reaching("available", updates.setChannel("latest", ANY_RELEASE));
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
          const updates = yield* Updates;
          yield* updates.configure;
          const stable = yield* reaching("available", updates.setChannel("latest", ANY_RELEASE));
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
        const updates = yield* Updates;
        yield* updates.configure;
        const failed = yield* reaching("error", updates.check("test"));
        assert.equal(failed.errorContext, "check");
      }),
    ),
  );
});
