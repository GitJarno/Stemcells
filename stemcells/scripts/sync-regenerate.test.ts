// @effect-diagnostics nodeBuiltinImport:off - replays a past sync in a scratch git repository.
// A sync writes generated files again instead of merging them (sync-upstream, GENERATED). This
// replays the sync of 2026-11-08 in a scratch repository that borrows this one's objects and runs
// the real step on it. The route tree's generator is the real one; `pnpm`, which the others go
// through, is stood in for, as the scratch tree has nothing installed.
import * as NodeChildProcess from "node:child_process";
import * as NodeFS from "node:fs";
import * as NodeOS from "node:os";
import * as NodePath from "node:path";
import * as NodeURL from "node:url";
import { afterEach, describe, expect, it } from "vite-plus/test";

const scripts = NodePath.dirname(NodeURL.fileURLToPath(import.meta.url));
const syncUpstream = NodePath.join(scripts, "sync-upstream");

// The sync of 2026-11-08 (stemcells/scripts/sync-stats): main before it, upstream's commit, and
// the merge that landed, which holds how its other conflicts were resolved.
const OURS = "52d173f08";
const THEIRS = "a9e709f15";
const MERGED = "3c2644b08";

const LOCKFILE = "pnpm-lock.yaml";
const ROUTE_TREE = "apps/web/src/routeTree.gen.ts";
const BUDGET = "apps/server/src/provider/agentContextBudget.json";

const PNPM = `#!/bin/sh
echo "$*" >> "$PNPM_LOG"
[ "$1" = "$PNPM_FAILS" ] && exit 1
exit 0
`;

const scratch: string[] = [];
afterEach(() => {
  for (const dir of scratch.splice(0)) NodeFS.rmSync(dir, { recursive: true, force: true });
});

/** The 2026-11-08 merge, stopped where git left it. */
function replay() {
  const root = NodeFS.mkdtempSync(NodePath.join(NodeOS.tmpdir(), "sync-regenerate-"));
  scratch.push(root);
  const work = NodePath.join(root, "work");
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    // Not the person's own git config or repository: no hooks, no signing, no leaked GIT_DIR.
    GIT_DIR: undefined,
    GIT_WORK_TREE: undefined,
    GIT_INDEX_FILE: undefined,
    GIT_CONFIG_GLOBAL: "/dev/null",
    GIT_AUTHOR_NAME: "Example",
    GIT_AUTHOR_EMAIL: "example@example.com",
    GIT_COMMITTER_NAME: "Example",
    GIT_COMMITTER_EMAIL: "example@example.com",
    PATH: `${NodePath.join(root, "bin")}:${process.env.PATH}`,
    PNPM_LOG: NodePath.join(root, "pnpm.log"),
  };
  const git = (...args: string[]) =>
    NodeChildProcess.execFileSync("git", args, { cwd: work, encoding: "utf8", env }).trim();
  const objects = NodePath.join(
    NodeChildProcess.execFileSync(
      "git",
      ["rev-parse", "--path-format=absolute", "--git-common-dir"],
      { cwd: scripts, encoding: "utf8", env },
    ).trim(),
    "objects",
  );

  NodeFS.mkdirSync(NodePath.join(root, "bin"));
  NodeFS.writeFileSync(NodePath.join(root, "bin", "pnpm"), PNPM, { mode: 0o755 });
  NodeFS.mkdirSync(work);
  git("init", "-q", "-b", "sync");
  NodeFS.writeFileSync(NodePath.join(work, ".git", "objects", "info", "alternates"), objects);
  // Only the folders the generated files and their generators are in.
  git(
    "sparse-checkout",
    "set",
    "--cone",
    "apps/web/src/routes",
    "apps/server/src/provider",
    "apps/mobile/scripts",
  );
  git("checkout", "-q", OURS);
  NodeChildProcess.spawnSync("git", ["merge", "-q", "--no-commit", "--no-ff", THEIRS], {
    cwd: work,
    env,
  });

  const conflicted = () =>
    git("diff", "--name-only", "--diff-filter=U").split("\n").filter(Boolean);
  const regenerate = (more: NodeJS.ProcessEnv = {}) => {
    const result = NodeChildProcess.spawnSync("bash", [syncUpstream, "--regenerate"], {
      cwd: work,
      encoding: "utf8",
      env: { ...env, ...more },
    });
    return { code: result.status ?? -1, out: `${result.stdout}${result.stderr}` };
  };
  const pnpmRan = () =>
    NodeFS.existsSync(env.PNPM_LOG!)
      ? NodeFS.readFileSync(env.PNPM_LOG!, "utf8").split("\n").filter(Boolean)
      : [];
  const read = (file: string) => NodeFS.readFileSync(NodePath.join(work, file), "utf8");
  return { work, git, conflicted, regenerate, pnpmRan, read };
}

describe("a sync's generated files", () => {
  it("take upstream's side, then are written again once the rest is resolved", () => {
    const repo = replay();
    expect(repo.conflicted()).toEqual(expect.arrayContaining([LOCKFILE, ROUTE_TREE, BUDGET]));

    // With other conflicts open, a generator would read a half-merged tree: none runs yet.
    const first = repo.regenerate();
    expect(first.code).toBe(3);
    const left = repo.conflicted();
    expect(left).not.toHaveLength(0);
    for (const file of [LOCKFILE, ROUTE_TREE, BUDGET]) {
      expect(left).not.toContain(file);
      expect(first.out).not.toContain(`  ${file}\n`);
      expect(repo.git("diff", "--cached", "--name-only", THEIRS, "--", file)).toBe("");
    }
    expect(first.out).toContain(`  ${left[0]}\n`);
    expect(repo.pnpmRan()).toEqual([]);

    // The rest, as that sync resolved it.
    repo.git("checkout", "-q", MERGED, "--", ...left);
    const second = repo.regenerate();
    expect(second.out).toContain("generated files written and staged");
    expect(second.code).toBe(0);
    expect(repo.conflicted()).toEqual([]);

    // The install comes first, as the other generators run what it installs.
    const ran = repo.pnpmRan();
    expect(ran[0]).toBe("install --no-frozen-lockfile");
    expect(ran[1]).toBe("--filter @t3tools/mobile run generate");
    expect(ran[2]).toContain("AgentContextBudget.test.ts");

    // The real generator's tree: every route of ours and of upstream's, staged.
    const tree = repo.read(ROUTE_TREE);
    expect(tree).not.toMatch(/^(<<<<<<<|=======|>>>>>>>)/m);
    const routes = NodeFS.readdirSync(NodePath.join(repo.work, "apps/web/src/routes"))
      .filter((name) => name.endsWith(".tsx"))
      .map((name) => name.replace(/\.tsx$/, ""));
    expect(routes).toContain("_chat.settings.disk");
    expect(routes).toContain("_chat.settings.devices");
    for (const route of routes) expect(tree, route).toContain(`from './routes/${route}'`);
    expect(repo.git("diff", "--name-only", "--", ROUTE_TREE)).toBe("");
    expect(repo.git("diff", "--cached", "--name-only", OURS, "--", ROUTE_TREE)).toBe(ROUTE_TREE);
  });

  it("stop the sync, naming the file, when a generator fails", () => {
    const repo = replay();
    repo.regenerate();
    repo.git("checkout", "-q", MERGED, "--", ...repo.conflicted());
    const { code, out } = repo.regenerate({ PNPM_FAILS: "install" });
    expect(code).toBe(6);
    expect(out).toContain(`the generator of ${LOCKFILE} failed`);
    // Nothing after it ran.
    expect(repo.pnpmRan()).toEqual(["install --no-frozen-lockfile"]);
  });
});
