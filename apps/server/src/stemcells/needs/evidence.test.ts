import { describe, expect, it } from "vite-plus/test";

import { GOAL_CAP, changedOf, checkKindOf, checksOf, goalOf } from "./evidence.ts";

const told = (...texts: string[]) => texts.map((text) => ({ text, news: false }));

describe("the instruction a Cell is on", () => {
  it("is the last message of substance: a nudge leaves the one before it standing", () => {
    expect(
      goalOf(told("Move the header tokens into the theme file", "yes, go ahead", "ok push it")),
    ).toBe("Move the header tokens into the theme file");
  });

  it("moves on when the person gives a new instruction", () => {
    expect(
      goalOf(
        told(
          "Move the header tokens into the theme file",
          "Now do the same for the footer and open a pull request",
        ),
      ),
    ).toBe("Now do the same for the footer and open a pull request");
  });

  it("never takes a wake or a notification for an instruction", () => {
    expect(
      goalOf([
        { text: "Fix the tab", news: false },
        {
          text: "The checks on #12 failed: lint, test and the build all report errors",
          news: true,
        },
      ]),
    ).toBe("Fix the tab");
  });

  it("ends a long one at a word", () => {
    const goal = goalOf(told("word ".repeat(200)));
    expect(goal?.length).toBeLessThanOrEqual(GOAL_CAP + 1);
    expect(goal?.endsWith("word…")).toBe(true);
  });

  it("is null when nobody said anything", () => {
    expect(goalOf([])).toBeNull();
  });
});

describe("the checks a run ran", () => {
  it.each([
    ["pnpm exec vp test run src/stemcells/needs", "test"],
    ["cd apps/web && VITEST_MAX_WORKERS=2 pnpm exec vp test run src", "test"],
    ["vp run check:changed", "test"],
    ["stemcells/scripts/check-local 12", "test"],
    ["cargo test --workspace", "test"],
    ["pnpm exec vp run --filter @t3tools/web typecheck", "typecheck"],
    ["npx tsc --noEmit", "typecheck"],
    ["pnpm lint", "lint"],
    ["pnpm run build", "build"],
    ["git log --oneline -5", null],
    ["cat build/test-output.txt", null],
    ["ls apps/web/src/latest", null],
    ["grep -rn contest src", null],
    ["env -u GIT_DIR stemcells/scripts/check-local 12", "test"],
    ["(cd apps/web && pnpm --filter @t3tools/web test)", "test"],
    ["python -m pytest -q", "test"],
    ["cargo check", "typecheck"],
    ["grep -rn lint src", null],
    ["cat eslint.config.js", null],
    ["pnpm add -D vitest", null],
    ["test -f package.json", null],
    ['git commit -m "fix typecheck && pnpm test"', null],
    ['/bin/zsh -lc "cd apps/web && pnpm test"', "test"],
    ["/bin/zsh -lc 'git commit -m \"pnpm test passes\"'", null],
    ["timeout 600 pnpm lint", "lint"],
    ["cat <<'EOF' > notes.md\npnpm run build\nEOF", null],
    ["pnpm -C packages/build install", null],
    ["cargo run -- test", null],
  ] as const)("%s", (command, kind) => {
    expect(checkKindOf(command)).toBe(kind);
  });

  it("stands each kind on its last run: a rerun that passes clears the failure", () => {
    expect(
      checksOf([
        { command: "pnpm test", failed: true },
        { command: "pnpm lint", failed: false },
        { command: "pnpm test", failed: false },
        { command: "pnpm run typecheck", failed: true },
        { command: "git status", failed: true },
      ]),
    ).toEqual([
      { kind: "test", ok: true },
      { kind: "typecheck", ok: false },
      { kind: "lint", ok: true },
    ]);
  });
});

it("counts a file changed twice once, its lines summed", () => {
  expect(
    changedOf([
      { path: "a.ts", additions: 4, deletions: 1 },
      { path: "a.ts", additions: 2, deletions: 0 },
      { path: "b.ts", additions: 1, deletions: 9 },
    ]),
  ).toEqual({ files: 2, additions: 7, deletions: 10 });
  expect(changedOf([])).toBeNull();
});
