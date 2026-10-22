import { describe, expect, it } from "vite-plus/test";

import { resolveNewTaskWorkspaceSelection } from "../../features/threads/new-task-context-presentation";

/**
 * Contract: a new task's own workspace choice beats the project's default.
 * Settings › Disk opens its cleanup Cell with "local" in the draft
 * (`upstream/disk.ts`), so a project that defaults to new worktrees doesn't
 * copy its checkout and run an install on a disk that is already full.
 */

const LOCAL = { mode: "local", branch: null, worktreePath: null } as const;
const NEW_WORKTREE = { mode: "worktree", branch: null, worktreePath: null } as const;

describe("a new task's workspace", () => {
  it("is the draft's own choice over a project that defaults to new worktrees", () => {
    expect(
      resolveNewTaskWorkspaceSelection({
        selection: LOCAL,
        fallback: NEW_WORKTREE,
        isGitRepo: true,
      }).mode,
    ).toBe("local");
  });
});
