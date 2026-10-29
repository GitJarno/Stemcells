// @effect-diagnostics nodeBuiltinImport:off - runs check-local in a scratch git repository.
/**
 * check-local's guard: it runs only our own, a pull request the account running it opened from a
 * branch of this repository, or a commit on one of origin's branches. Anyone else's never runs on
 * the Mac (stemcells/AGENTS.md). Each case runs the real script against a scratch origin, with
 * `gh` and `pnpm` stood in for and a gates script that leaves a mark when it runs.
 */
import * as NodeChildProcess from "node:child_process";
import * as NodeFS from "node:fs";
import * as NodeOS from "node:os";
import * as NodePath from "node:path";
import * as NodeURL from "node:url";
import { afterEach, describe, expect, it } from "vite-plus/test";

const checkLocal = NodePath.join(
  NodePath.dirname(NodeURL.fileURLToPath(import.meta.url)),
  "check-local",
);

// `gh api <path> --jq <expr>` answers from the fixtures, through jq as gh's own would.
const GH = `#!/usr/bin/env bash
echo "$*" >> "$GH_LOG"
case "$2" in
  user) jq -r "$4" <<< '{"login":"me"}' ;;
  */pulls/*) jq -r "$4" "$PULL_JSON" ;;
  */statuses/*) ;;
  *) exit 1 ;;
esac
`;

const scratch: string[] = [];
afterEach(() => {
  for (const dir of scratch.splice(0)) NodeFS.rmSync(dir, { recursive: true, force: true });
});

function repository() {
  const root = NodeFS.mkdtempSync(NodePath.join(NodeOS.tmpdir(), "check-local-"));
  scratch.push(root);
  const at = (...parts: string[]) => NodePath.join(root, ...parts);
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
    PATH: `${at("bin")}:${process.env.PATH}`,
    TMPDIR: at("tmp"),
    GH_LOG: at("gh.log"),
    PULL_JSON: at("pull.json"),
    CHECK_RAN: at("check-ran"),
  };
  const git = (...args: string[]) =>
    NodeChildProcess.execFileSync("git", args, { cwd: at("work"), encoding: "utf8", env }).trim();
  const write = (file: string, text: string, mode = 0o644) => {
    NodeFS.mkdirSync(NodePath.dirname(file), { recursive: true });
    NodeFS.writeFileSync(file, text, { mode });
  };

  write(at("bin", "gh"), GH, 0o755);
  write(at("bin", "pnpm"), "#!/bin/sh\nexit 0\n", 0o755);
  NodeFS.mkdirSync(at("tmp"));
  NodeChildProcess.execFileSync("git", ["init", "-q", "--bare", at("origin.git")], { env });
  NodeChildProcess.execFileSync("git", ["init", "-q", "-b", "main", at("work")], { env });
  git("remote", "add", "origin", at("origin.git"));
  write(at("work", "stemcells", "scripts", "publishable"), "#!/bin/sh\nexit 0\n", 0o755);
  write(
    at("work", "stemcells", "scripts", "sync-upstream"),
    '#!/bin/sh\ntouch "$CHECK_RAN"\n',
    0o755,
  );
  git("add", ".");
  git("commit", "-q", "-m", "ours");
  git("push", "-q", "origin", "main");
  const ours = git("rev-parse", "HEAD");
  git("commit", "-q", "--allow-empty", "-m", "from elsewhere");
  const elsewhere = git("rev-parse", "HEAD");
  git("push", "-q", "origin", `${elsewhere}:refs/pull/8/head`);
  git("push", "-q", "origin", `${ours}:refs/pull/7/head`);

  // The repository as check-local names it from origin's URL.
  const here = at("origin");
  const pull = (sha: string, author: string, head: string | null) =>
    write(
      at("pull.json"),
      JSON.stringify({
        user: { login: author },
        head: { sha, repo: head === null ? null : { full_name: head } },
        base: { repo: { full_name: here } },
      }),
    );
  const run = (target: string) => {
    const result = NodeChildProcess.spawnSync("bash", [checkLocal, target], {
      cwd: at("work"),
      encoding: "utf8",
      env,
    });
    return {
      code: result.status ?? -1,
      ran: NodeFS.existsSync(at("check-ran")),
      recorded: NodeFS.existsSync(at("gh.log"))
        ? NodeFS.readFileSync(at("gh.log"), "utf8")
            .split("\n")
            .filter((line) => line.includes("/statuses/"))
        : [],
    };
  };
  return { here, ours, elsewhere, pull, run };
}

describe("check-local runs only our own", () => {
  it("checks a pull request we opened from a branch here and records the verdict on its head", () => {
    const repo = repository();
    repo.pull(repo.ours, "me", repo.here);
    const result = repo.run("7");
    expect(result.code).toBe(0);
    expect(result.ran).toBe(true);
    expect(result.recorded).toHaveLength(1);
    expect(result.recorded[0]).toContain(`/statuses/${repo.ours}`);
    expect(result.recorded[0]).toContain("state=success");
  });

  it.each([
    ["a fork", "someone", "someone/stemcells"],
    ["a fork since deleted", "someone", null],
    ["someone else, from a branch here", "someone", "HERE"],
  ])("refuses a pull request from %s, running and recording nothing", (_, author, head) => {
    const repo = repository();
    repo.pull(repo.elsewhere, author, head === "HERE" ? repo.here : head);
    const result = repo.run("8");
    expect(result.code).not.toBe(0);
    expect(result.ran).toBe(false);
    expect(result.recorded).toEqual([]);
  });

  it("refuses a commit no branch of origin holds", () => {
    const repo = repository();
    const result = repo.run(repo.elsewhere);
    expect(result.code).not.toBe(0);
    expect(result.ran).toBe(false);
    expect(result.recorded).toEqual([]);
  });
});
