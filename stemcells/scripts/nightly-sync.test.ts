// @effect-diagnostics nodeBuiltinImport:off - runs the nightly against a scratch origin and home.
/**
 * A night that stops on a conflict may start a Cell, which spends the person's model plan
 * (install-nightly-sync --cell). The real scripts run in a scratch home against a scratch origin;
 * the Mac's tools, `gh` and the app's `t3` launcher are stood in for: no app is asked, no model runs.
 */
import * as NodeChildProcess from "node:child_process";
import * as NodeFS from "node:fs";
import * as NodeOS from "node:os";
import * as NodePath from "node:path";
import * as NodeURL from "node:url";
import { afterEach, describe, expect, it } from "vite-plus/test";

const scripts = NodePath.dirname(NodeURL.fileURLToPath(import.meta.url));

// The sync, as far into a merge as the real one is when it stops, and the issue it kept.
const SYNC_UPSTREAM = `#!/bin/sh
[ "$1" = --nightly ] || exit 64
[ -z "$FAKE_TARGET" ] || git merge -q --no-commit --no-ff "$FAKE_TARGET" || exit 70
[ -z "$SYNC_ISSUE" ] || echo 12 > "$SYNC_ISSUE"
exit "$FAKE_EXIT"
`;

// The app's launcher: one line per call, and an error that names the home, as the real one's does.
const T3 = `#!/bin/sh
printf '%s ' "$@" | tr '\\n' ' ' >> "$T3_LOG"
echo >> "$T3_LOG"
if [ -n "$T3_FAILS" ]; then
  echo "No running server uses $HOME/.stemcells. Start it, then retry." >&2
  exit 1
fi
case "$2" in
  list) echo "$T3_LIST" ;;
  start) echo thread-1 ;;
esac
`;

const GH = `#!/bin/sh
echo "$*" >> "$GH_LOG"
case "$2" in
  */pulls\\?*) echo "$OPEN_SYNC_PULL" ;;
esac
`;

const FAKES: Record<string, string> = {
  gh: GH,
  pmset: "#!/bin/sh\necho \"Now drawing from 'AC Power'\"\n",
  sysctl:
    '#!/bin/sh\ncase "$2" in hw.ncpu) echo 8 ;; vm.loadavg) echo "{ 0.50 0.50 0.50 }" ;; esac\n',
  // The real one finds the gates this test runs under (sync-upstream --gates), and skips the night.
  pgrep: "#!/bin/sh\nexit 1\n",
  pnpm: "#!/bin/sh\nexit 0\n",
};

const scratch: string[] = [];
afterEach(() => {
  for (const dir of scratch.splice(0)) NodeFS.rmSync(dir, { recursive: true, force: true });
});

function mac() {
  const root = NodeFS.realpathSync(
    NodeFS.mkdtempSync(NodePath.join(NodeOS.tmpdir(), "nightly-sync-")),
  );
  scratch.push(root);
  const at = (...parts: string[]) => NodePath.join(root, ...parts);
  const write = (file: string, text: string, mode = 0o755) => {
    NodeFS.mkdirSync(NodePath.dirname(file), { recursive: true });
    NodeFS.writeFileSync(file, text, { mode });
  };
  const lines = (file: string) =>
    NodeFS.existsSync(file) ? NodeFS.readFileSync(file, "utf8").split("\n").filter(Boolean) : [];
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    // Not the person's own git config, repository, home or app.
    GIT_DIR: undefined,
    GIT_WORK_TREE: undefined,
    GIT_INDEX_FILE: undefined,
    GIT_CONFIG_GLOBAL: "/dev/null",
    GIT_AUTHOR_NAME: "Example",
    GIT_AUTHOR_EMAIL: "example@example.com",
    GIT_COMMITTER_NAME: "Example",
    GIT_COMMITTER_EMAIL: "example@example.com",
    T3CODE_HOME: undefined,
    STEMCELLS_SYNC_MAX_LOAD: undefined,
    STEMCELLS_SYNC_CELL_PROJECT: undefined,
    STEMCELLS_SYNC_CELL_PROVIDER: undefined,
    STEMCELLS_SYNC_CELL_MODEL: undefined,
    HOME: at("home"),
    TMPDIR: at("tmp"),
    PATH: `${at("bin")}:${process.env.PATH}`,
    STEMCELLS_SYNC_ORIGIN: at("origin"),
    GH_LOG: at("gh.log"),
    T3_LOG: at("t3.log"),
  };
  for (const [name, text] of Object.entries(FAKES)) write(at("bin", name), text);
  const launcher = at("home", ".stemcells", "bin", "t3");
  write(launcher, T3);
  NodeFS.mkdirSync(at("tmp"));

  const git = (...args: string[]) =>
    NodeChildProcess.execFileSync("git", args, {
      cwd: at("origin"),
      encoding: "utf8",
      env,
    }).trim();
  NodeChildProcess.execFileSync("git", ["init", "-q", "-b", "main", at("origin")], { env });
  write(at("origin", "stemcells", "scripts", "sync-upstream"), SYNC_UPSTREAM);
  git("add", ".");
  git("commit", "-q", "-m", "ours");
  // Two of upstream's commits, a night apart.
  const upstream = ["first", "second"].map((name) => {
    git("switch", "-q", "-c", `upstream-${name}`, "main");
    git("commit", "-q", "--allow-empty", "-m", `upstream's ${name}`);
    return git("rev-parse", "HEAD");
  }) as [string, string];
  git("switch", "-q", "main");

  /** One night: the sync ends with `exit`, stopped in a merge of `target` when it names one. */
  const night = (exit: number, target = "", more: NodeJS.ProcessEnv = {}) => {
    const result = NodeChildProcess.spawnSync("bash", [NodePath.join(scripts, "nightly-sync")], {
      cwd: root,
      encoding: "utf8",
      env: { ...env, FAKE_EXIT: String(exit), FAKE_TARGET: target, ...more },
    });
    return { code: result.status ?? -1, out: `${result.stdout}${result.stderr}` };
  };
  const install = (...args: string[]) => {
    const result = NodeChildProcess.spawnSync(
      "bash",
      [NodePath.join(scripts, "install-nightly-sync"), ...args],
      { cwd: root, encoding: "utf8", env: { ...env, ...installEnv } },
    );
    return { code: result.status ?? -1, job: result.stdout, said: result.stderr };
  };
  const installEnv: NodeJS.ProcessEnv = {};
  return {
    root,
    at,
    write,
    upstream,
    night,
    install,
    installEnv,
    launcher,
    /** The Cells the launcher was asked to start, one line each. */
    started: () => lines(at("t3.log")).filter((line) => line.startsWith("thread start ")),
    asked: () => lines(at("t3.log")),
    /** What was said on the issue: each comment's text. */
    comments: () =>
      lines(at("gh.log"))
        .filter((line) => line.includes("/issues/12/comments"))
        .map((line) => line.slice(line.indexOf("body=") + 5)),
  };
}

const CELL = { STEMCELLS_SYNC_CELL_PROJECT: "project-1" };

describe("a night that stops on a conflict", () => {
  it("waits for a person unless the install opted in to a Cell", () => {
    const here = mac();
    const [first] = here.upstream;
    expect(here.night(3, first).code).toBe(3);
    expect(here.asked()).toEqual([]);
    expect(here.comments()).toEqual([]);
  });

  it("starts one Cell per upstream commit, naming the commit and the issue", () => {
    const here = mac();
    const [first, second] = here.upstream;

    const night = here.night(3, first, CELL);
    // The night ends as it would without the Cell.
    expect(night.code).toBe(3);
    expect(here.started()).toHaveLength(1);
    const start = here.started()[0]!;
    expect(start).toContain("thread start project-1 ");
    expect(start).toContain(first);
    expect(start).toContain("#12");
    expect(start).toContain(".agents/skills/t3-sync/SKILL.md");
    // A worktree of its own, never the checkout the person works in.
    expect(start).toContain("--worktree origin/main");
    expect(start).not.toContain("--model");
    expect(here.comments()).toHaveLength(1);
    expect(here.comments()[0]).toContain("started a Cell");

    // The next night upstream hasn't moved: the same commit, and no second Cell.
    const again = here.night(3, first, CELL);
    expect(again.code).toBe(3);
    expect(again.out).toContain("has one already");
    expect(here.started()).toHaveLength(1);

    // A new upstream commit may have its own, on the model the install named.
    here.night(3, second, {
      ...CELL,
      STEMCELLS_SYNC_CELL_PROVIDER: "provider-1",
      STEMCELLS_SYNC_CELL_MODEL: "model-1",
    });
    expect(here.started()).toHaveLength(2);
    expect(here.started()[1]).toContain(second);
    expect(here.started()[1]).toContain("--provider provider-1 --model model-1");
  });

  it.each([0, 4, 5, 6, 1])("starts none when the sync ends with exit %i", (exit) => {
    const here = mac();
    expect(here.night(exit, "", CELL).code).toBe(exit);
    expect(here.asked()).toEqual([]);
  });

  it("leaves an open sync pull request to its owner", () => {
    const here = mac();
    const night = here.night(3, here.upstream[0], { ...CELL, OPEN_SYNC_PULL: "41" });
    expect(night.code).toBe(3);
    expect(night.out).toContain("#41");
    expect(here.asked()).toEqual([]);
  });

  it.each([
    ["the app isn't running", { T3_FAILS: "1" }, false],
    ["the app's launcher is missing", {}, true],
  ])("waits for a person when %s, and tries again the next night", (_, fails, missing) => {
    const here = mac();
    const [first] = here.upstream;
    if (missing) NodeFS.renameSync(here.launcher, `${here.launcher}.away`);

    const night = here.night(3, first, { ...CELL, ...fails });
    // Never a failed night because of the Cell: the sync's own exit code.
    expect(night.code).toBe(3);
    expect(night.out).toContain("no Cell:");
    expect(here.started()).toHaveLength(missing ? 0 : 1);
    // The issue says so, without the launcher's words: they name this Mac's folders.
    expect(here.comments()).toHaveLength(1);
    expect(here.comments()[0]).toContain("could not start one");
    expect(here.comments()[0]).not.toContain(here.at("home"));

    if (missing) NodeFS.renameSync(`${here.launcher}.away`, here.launcher);
    here.night(3, first, CELL);
    expect(here.started()).toHaveLength(missing ? 1 : 2);
    expect(here.comments().at(-1)).toContain("started a Cell");
  });
});

describe("install-nightly-sync", () => {
  // Upstream's Node, whichever one runs this test: the installer refuses another.
  const installer = () => {
    const here = mac();
    here.write(here.at("bin", "node"), "#!/bin/sh\necho 26\n");
    return here;
  };

  it("leaves the Cell out of the job unless asked for", () => {
    const here = installer();
    const { code, job } = here.install("--print");
    expect(code).toBe(0);
    expect(job).toContain("<key>STEMCELLS_SYNC_ORIGIN</key>");
    expect(job).not.toContain("STEMCELLS_SYNC_CELL");
    expect(here.asked()).toEqual([]);
  });

  it("names the Cell's project by the id the running app gives its folder", () => {
    const here = installer();
    here.installEnv.T3_LIST = '[{"threadId":"thread-0","projectId":"project-1","title":"A Cell"}]';
    const { code, job } = here.install(
      "--print",
      "--cell",
      here.root,
      "--provider",
      "provider-1",
      "--model",
      "model-1",
    );
    expect(code).toBe(0);
    expect(here.asked()).toEqual([`thread list --project ${here.root} --json `]);
    for (const [key, value] of [
      ["STEMCELLS_SYNC_CELL_PROJECT", "project-1"],
      ["STEMCELLS_SYNC_CELL_PROVIDER", "provider-1"],
      ["STEMCELLS_SYNC_CELL_MODEL", "model-1"],
    ]) {
      expect(job).toContain(`<key>${key}</key>\n    <string>${value}</string>`);
    }
  });

  it("installs no job that could not start a Cell", () => {
    const here = installer();
    here.installEnv.T3_FAILS = "1";
    const { code, job, said } = here.install("--print", "--cell", here.root);
    expect(code).toBe(1);
    expect(job).toBe("");
    expect(said).toContain("is the app open");
  });
});
