// @effect-diagnostics nodeBuiltinImport:off - runs drift in a scratch git repository.
/**
 * drift's guard on hot files: our lines and hunks in a file upstream edits about daily grow
 * only with a seams.md "Hot-file budget" row that says why (stemcells/docs/fork.md, rule 7).
 * Each case runs the real script in a small repository, with "hot" lowered to two commits.
 */
import * as NodeChildProcess from "node:child_process";
import * as NodeFS from "node:fs";
import * as NodeOS from "node:os";
import * as NodePath from "node:path";
import * as NodeURL from "node:url";
import { afterEach, describe, expect, it } from "vite-plus/test";

const scripts = NodePath.dirname(NodeURL.fileURLToPath(import.meta.url));
const drift = NodePath.join(scripts, "drift");

const SEAMS = `# Seams

| File | Change | Why |
|---|---|---|
| \`app/hot.ts\` | Line 3 says ours | A seam |
| \`app/cold.ts\` | Line 2 says ours | A seam |
`;

const scratch: string[] = [];
afterEach(() => {
  for (const dir of scratch.splice(0)) NodeFS.rmSync(dir, { recursive: true, force: true });
});

function lines(name: string, count: number): string {
  return Array.from({ length: count }, (_, index) => `export const ${name}${index} = ${index};`)
    .join("\n")
    .concat("\n");
}

/** A repository whose upstream edited app/hot.ts three times, and our main with one seam line in each file. */
function repository(): {
  readonly root: string;
  readonly git: (...args: string[]) => string;
  readonly write: (file: string, text: string) => void;
  readonly edit: (file: string, line: number, text: string) => void;
  readonly run: (...args: string[]) => { readonly code: number; readonly out: string };
} {
  const root = NodeFS.mkdtempSync(NodePath.join(NodeOS.tmpdir(), "drift-"));
  scratch.push(root);
  const git = (...args: string[]) =>
    NodeChildProcess.execFileSync("git", args, {
      cwd: root,
      encoding: "utf8",
      env: {
        ...process.env,
        // Not the person's own git config: no hooks, no signing.
        GIT_CONFIG_GLOBAL: "/dev/null",
        GIT_AUTHOR_NAME: "Example",
        GIT_AUTHOR_EMAIL: "example@example.com",
        GIT_COMMITTER_NAME: "Example",
        GIT_COMMITTER_EMAIL: "example@example.com",
      },
    });
  const write = (file: string, text: string) => {
    NodeFS.mkdirSync(NodePath.dirname(NodePath.join(root, file)), { recursive: true });
    NodeFS.writeFileSync(NodePath.join(root, file), text);
  };
  const edit = (file: string, line: number, text: string) => {
    const path = NodePath.join(root, file);
    const all = NodeFS.readFileSync(path, "utf8").split("\n");
    all[line - 1] = text;
    NodeFS.writeFileSync(path, all.join("\n"));
  };
  const run = (...args: string[]) => {
    const result = NodeChildProcess.spawnSync("bash", [drift, ...args], {
      cwd: root,
      encoding: "utf8",
      env: { ...process.env, DRIFT_HOT: "2" },
    });
    return { code: result.status ?? -1, out: `${result.stdout}${result.stderr}` };
  };

  git("init", "-q", "-b", "upstream");
  write("app/hot.ts", lines("hot", 40));
  write("app/cold.ts", lines("cold", 10));
  write("app/cold.test.ts", lines("coldTest", 10));
  git("add", ".");
  git("commit", "-q", "-m", "upstream: start");
  for (const turn of [1, 2]) {
    edit("app/hot.ts", 30 + turn, `export const upstream${turn} = ${turn};`);
    git("commit", "-q", "-am", `upstream: edit ${turn}`);
  }
  git("update-ref", "refs/remotes/upstream/main", "HEAD");

  git("switch", "-q", "-c", "main");
  write("stemcells/seams.md", SEAMS);
  edit("app/hot.ts", 3, "export const ours = 3;");
  edit("app/cold.ts", 2, "export const ours = 2;");
  git("add", ".");
  git("commit", "-q", "-m", "ours: two seams");
  git("update-ref", "refs/remotes/origin/main", "HEAD");
  return { root, git, write, edit, run };
}

const budget = (row: string) => `${SEAMS}
## Hot-file budget

| File | Lines | Hunks | Why |
|---|---|---|---|
${row}
`;

describe("drift's hot-file budget", () => {
  it("marks the hot file, and passes while it hasn't grown, asking for a row", () => {
    const repo = repository();
    const { code, out } = repo.run();
    expect(out).toMatch(/hot\s+3\s+2\s+1\s+app\/hot\.ts\s+no row in the Hot-file budget/);
    expect(out).toMatch(/seam\s+1\s+2\s+1\s+app\/cold\.ts/);
    expect(out).toContain("2 upstream files changed, 4 lines in 2 hunks; 1 hot");
    expect(code).toBe(0);
  });

  it("fails when a hot file grows past main with no row", () => {
    const repo = repository();
    repo.edit("app/hot.ts", 10, "export const more = 10;");
    const { code, out } = repo.run();
    expect(out).toContain("OVER: grew from 2 lines, 1 hunks");
    expect(code).toBe(1);
  });

  it("lets a hot file grow up to its row, and fails past it", () => {
    const repo = repository();
    repo.edit("app/hot.ts", 10, "export const more = 10;");
    repo.write("stemcells/seams.md", budget("| `app/hot.ts` | 4 | 2 | Two seams |"));
    expect(repo.run().code).toBe(0);

    repo.edit("app/hot.ts", 20, "export const evenMore = 20;");
    const { code, out } = repo.run();
    expect(out).toContain("OVER its budget of 4 lines, 2 hunks");
    expect(code).toBe(1);
  });

  it("fails on a row with no reason", () => {
    const repo = repository();
    repo.write("stemcells/seams.md", budget("| `app/hot.ts` | 9 | 9 |  |"));
    const { code, out } = repo.run();
    expect(out).toContain("gives no reason");
    expect(code).toBe(1);
  });

  it("fails on a row whose lines or hunks aren't whole numbers", () => {
    for (const row of [
      "| `app/hot.ts` | 10 lines | 17 | Words in a number cell |",
      "| `app/hot.ts` | 10 | | No hunks |",
      "| `app/hot.ts` | 1 0 | 9 | A split number |",
      "| `app/hot.ts` | 10 |",
    ]) {
      const repo = repository();
      repo.write("stemcells/seams.md", budget(row));
      const { code, out } = repo.run();
      expect(out, row).toContain("must be whole numbers");
      expect(out, row).not.toContain("integer expression expected");
      expect(code, row).toBe(1);
    }
  });

  it("asks for a lower row once a hot file shrinks", () => {
    const repo = repository();
    repo.write("stemcells/seams.md", budget("| `app/hot.ts` | 6 | 3 | Was bigger |"));
    const { code, out } = repo.run();
    expect(out).toContain("lower its row to 2, 1");
    expect(code).toBe(0);
  });

  it("never measures a cold file against a budget", () => {
    const repo = repository();
    repo.edit("app/cold.ts", 5, "export const more = 5;");
    expect(repo.run().code).toBe(0);
  });

  it("still fails on an upstream change seams.md doesn't name", () => {
    const repo = repository();
    repo.write("app/new.ts", "export const ours = 1;\n");
    const { code, out } = repo.run();
    expect(out).toMatch(/DRIFT .*app\/new\.ts/);
    expect(code).toBe(1);
  });

  it("reads the rows in stemcells/seams/, and names the file a missing or stale row is in", () => {
    const repo = repository();
    repo.write("stemcells/seams.md", "# Seams\n");
    repo.write("stemcells/seams/rest.md", SEAMS);
    expect(repo.run().code).toBe(0);

    for (const file of ["apps/web/src/new.ts", "packages/shared/new.ts", "app/new.ts"]) {
      repo.write(file, "export const ours = 1;\n");
    }
    repo.write("stemcells/seams/rest.md", `${SEAMS}| \`app/same.ts\` | Nothing | A seam |\n`);
    const { code, out } = repo.run();
    expect(out).toMatch(/DRIFT .*apps\/web\/src\/new\.ts .*add one in stemcells\/seams\/web\.md/);
    expect(out).toMatch(/DRIFT .*packages\/shared\/new\.ts .*stemcells\/seams\/packages\.md/);
    expect(out).toMatch(/DRIFT .*app\/new\.ts .*stemcells\/seams\/rest\.md/);
    expect(out).toMatch(/STALE\s+app\/same\.ts\s+\(named in stemcells\/seams\/rest\.md/);
    expect(code).toBe(1);
  });

  it("prints the trend against the base for a pull request's body", () => {
    const repo = repository();
    repo.edit("app/hot.ts", 10, "export const more = 10;");
    repo.git("commit", "-q", "-am", "ours: more");
    const { code, out } = repo.run("--summary", "--base", "origin/main");
    expect(out).toContain("| Lines | 4 | 6 |");
    expect(out).toContain("| Hunks | 2 | 3 |");
    expect(out).toContain("| `app/hot.ts` | 3 | 2, 1 | 4, 2 |");
    expect(code).toBe(0);
  });
});

describe("drift's list of upstream tests still edited", () => {
  const SEAMS_WITH_TEST = `${SEAMS}| \`app/cold.test.ts\`, \`app/ours.test.ts\` | Tests | A seam |\n`;
  const LIST = "stemcells/edited-tests.txt";

  /** Our main edits upstream's test and has it on the list. */
  function withEditedTest() {
    const repo = repository();
    repo.write("stemcells/seams.md", SEAMS_WITH_TEST);
    repo.edit("app/cold.test.ts", 2, "export const ours = 2;");
    repo.write("app/ours.test.ts", "export const ours = 1;\n");
    repo.write(LIST, "# Why each is still edited.\napp/cold.test.ts pins a name of ours\n");
    repo.git("add", ".");
    repo.git("commit", "-q", "-m", "ours: an edited test, listed");
    repo.git("update-ref", "refs/remotes/origin/main", "HEAD");
    return repo;
  }

  it("passes an edited test the list names, and a new test file of ours beside it", () => {
    const { code, out } = withEditedTest().run();
    expect(out).not.toMatch(/TEST|STALE/);
    expect(code).toBe(0);
  });

  it("fails on an edited upstream test the list doesn't name, or names without a reason", () => {
    for (const list of ["", "app/cold.test.ts\n"]) {
      const repo = withEditedTest();
      repo.write(LIST, list);
      const { code, out } = repo.run();
      expect(out, list).toMatch(/TEST .*app\/cold\.test\.ts/);
      expect(code, list).toBe(1);
    }
  });

  it("fails on a line the base doesn't have: the list only shrinks", () => {
    const repo = withEditedTest();
    repo.git("rm", "-q", "--cached", LIST);
    repo.git("commit", "-q", "-m", "ours: a base with an empty list");
    repo.write(LIST, "# Empty.\n");
    repo.git("add", LIST);
    repo.git("commit", "-q", "-m", "ours: the list, empty");
    repo.git("update-ref", "refs/remotes/origin/main", "HEAD");
    repo.write(LIST, "app/cold.test.ts pins a name of ours\n");
    const { code, out } = repo.run();
    expect(out).toMatch(/TEST .*app\/cold\.test\.ts .*only shrinks/);
    expect(code).toBe(1);
  });

  it("fails on a line whose test is upstream's again", () => {
    const repo = withEditedTest();
    repo.git("checkout", "upstream/main", "--", "app/cold.test.ts");
    const { code, out } = repo.run();
    expect(out).toMatch(/STALE .*app\/cold\.test\.ts .*drop its line/);
    expect(code).toBe(1);
  });
});

describe("the resolver of a sync's conflicts in upstream's tests", () => {
  it("takes a test that is upstream's again out of the file of rows naming it", () => {
    const repo = repository();
    const rows = "stemcells/seams/rest.md";
    repo.write(rows, `${SEAMS}| \`app/cold.test.ts\` | Line 2 says ours | A seam |\n`);
    repo.edit("app/cold.test.ts", 2, "export const ours = 2;");
    repo.git("add", ".");
    repo.git("commit", "-q", "-m", "ours: a swap in upstream's test");
    repo.git("switch", "-q", "upstream");
    repo.edit("app/cold.test.ts", 2, "export const theirs = 2;");
    repo.git("commit", "-q", "-am", "upstream: rewrites the line we swapped");
    repo.git("switch", "-q", "main");
    expect(() => repo.git("merge", "-q", "upstream")).toThrow();

    NodeChildProcess.execFileSync("node", [NodePath.join(scripts, "resolve-test-seams.mjs")], {
      cwd: repo.root,
    });
    const left = NodeFS.readFileSync(NodePath.join(repo.root, rows), "utf8");
    expect(left).not.toContain("app/cold.test.ts");
    expect(left).toContain("app/cold.ts");
    expect(repo.git("status", "--porcelain")).not.toMatch(/^(?:UU|.M) /m);
  });
});
