/**
 * Whether a chat's checkout is a git repository, as far as anything has said: the live git
 * status, else what this session last heard for it. Upstream's view assumes git until it hears
 * (`isGitRepo` defaults to true in ChatView), so a Cell's line shows git only once known. And
 * the branch the line names, by upstream's own rule for its branch picker.
 */
import { scopeProjectRef, scopeThreadRef } from "@t3tools/client-runtime/environment";
import type { EnvironmentId, ProjectId, ThreadId } from "@t3tools/contracts";
import { projectScriptCwd } from "@t3tools/shared/projectScripts";

import {
  resolveBranchToolbarValue,
  resolveEffectiveEnvMode,
} from "../../components/BranchToolbar.logic";
import { recallCheckoutIsRepo } from "../../components/ChatView.logic";
import { type DraftId, useComposerDraftStore } from "../../composerDraftStore";
import { useProject, useQuietThreadShell } from "../../state/entities";
import { useEnvironmentQuery } from "../../state/query";
import { vcsEnvironment } from "../../state/vcs";
import type { CellRef } from "../tabs/layout";

/** Known to be a repository: heard live, else heard earlier this session. Pending is not known. */
export function knownRepoOf(live: boolean | undefined, recalled: boolean | undefined): boolean {
  return (live ?? recalled) === true;
}

interface Checkout {
  readonly environmentId: EnvironmentId | null;
  readonly projectId: ProjectId | null;
  readonly worktreePath: string | null;
}

/** The same checkout and query upstream's view reads its git status from, so it asks nothing twice. */
function useCheckoutStatus(input: Checkout): {
  readonly knownRepo: boolean;
  readonly branch: string | null;
} {
  const project = useProject(
    input.environmentId !== null && input.projectId !== null
      ? scopeProjectRef(input.environmentId, input.projectId)
      : null,
  );
  const cwd = project
    ? projectScriptCwd({
        project: { cwd: project.workspaceRoot },
        worktreePath: input.worktreePath,
      })
    : null;
  const status = useEnvironmentQuery(
    cwd === null || input.environmentId === null
      ? null
      : vcsEnvironment.status({ environmentId: input.environmentId, input: { cwd } }),
  );
  const knownRepo =
    input.environmentId !== null &&
    knownRepoOf(status.data?.isRepo, recallCheckoutIsRepo(input.environmentId, cwd));
  return { knownRepo, branch: status.data?.refName ?? null };
}

/** Whether the checkout upstream's branch toolbar is given is known to be git. */
export function useCheckoutKnownRepo(input: {
  readonly environmentId: EnvironmentId;
  readonly projectId: ProjectId;
  readonly worktreePath: string | null;
}): boolean {
  return useCheckoutStatus(input).knownRepo;
}

/**
 * The branch a Cell's chat is on, or starts from while a draft, as
 * upstream's branch picker names it, and whether its checkout is known to
 * be git; no branch until it is, or while git names none.
 */
export function useCellBranch(cell: CellRef | null): {
  readonly knownRepo: boolean;
  readonly branch: string | null;
} {
  const threadRef =
    cell === null
      ? null
      : scopeThreadRef(cell.environmentId as EnvironmentId, cell.threadId as ThreadId);
  const shell = useQuietThreadShell(threadRef);
  const draft = useComposerDraftStore((store) =>
    cell === null
      ? null
      : cell.draftId !== null
        ? store.getDraftSession(cell.draftId as DraftId)
        : threadRef !== null
          ? store.getDraftThreadByRef(threadRef)
          : null,
  );
  const worktreePath = shell?.worktreePath ?? draft?.worktreePath ?? null;
  const status = useCheckoutStatus({
    environmentId: shell?.environmentId ?? draft?.environmentId ?? null,
    projectId: shell?.projectId ?? draft?.projectId ?? null,
    worktreePath,
  });
  if (!status.knownRepo) return { knownRepo: false, branch: null };
  const envMode = resolveEffectiveEnvMode({
    activeWorktreePath: worktreePath,
    hasServerThread: shell !== null,
    draftThreadEnvMode: draft?.envMode,
  });
  const branch = resolveBranchToolbarValue({
    envMode,
    activeWorktreePath: worktreePath,
    activeThreadBranch: shell?.branch ?? draft?.branch ?? null,
    currentGitBranch: status.branch,
  });
  return { knownRepo: true, branch };
}
