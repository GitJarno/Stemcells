/**
 * Whether a chat's checkout is git, as far as anything has said: upstream's view assumes git until
 * it hears (`isGitRepo` in ChatView), so a Cell's line shows git only once known. And the branch
 * the line names, by upstream's rule for its picker, or what its toolbar offers a folder of
 * repositories.
 */
import { scopeProjectRef, scopeThreadRef } from "@t3tools/client-runtime/environment";
import { resolveWorktreeRepositorySelection } from "@t3tools/client-runtime/state/thread-repositories";
import type { EnvironmentId, ProjectId, ThreadId } from "@t3tools/contracts";
import { projectScriptCwd } from "@t3tools/shared/projectScripts";
import { useMessages } from "gt-react";

import {
  type EnvMode,
  resolveBranchToolbarValue,
  resolveCurrentWorkspaceLabel,
  resolveEffectiveEnvMode,
  resolveEnvModeLabel,
  resolveLockedWorkspaceLabel,
} from "../../components/BranchToolbar.logic";
import { recallCheckoutIsRepo } from "../../components/ChatView.logic";
import { type DraftId, useComposerDraftStore } from "../../composerDraftStore";
import { useWorktreeRepositoryChoices } from "../../hooks/useWorktreeRepositoryChoices";
import { useProject, useQuietThreadShell } from "../../state/entities";
import { useEnvironmentQuery } from "../../state/query";
import { vcsEnvironment } from "../../state/vcs";
import {
  useRememberedWorktreeRepositories,
  useWorktreeBaseBranch,
} from "../../worktreeRepositoryChoiceStore";
import type { CellRef } from "../tabs/layout";

/** Known to be a repository: heard live, else heard earlier this session. Pending is not known. */
export function knownRepoOf(live: boolean | undefined, recalled: boolean | undefined): boolean {
  return (live ?? recalled) === true;
}

/**
 * What upstream's toolbar offers the ledge: a branch, once the checkout is known to be git, or
 * the repositories of a folder that is none itself. ChatView says the latter by offering the
 * controls with no branch controls, which it does only once it has heard the folder isn't git.
 */
export function envOfferOf(input: {
  readonly showGitControls: boolean;
  readonly showBranchControls: boolean | undefined;
  readonly knownRepo: boolean;
}): "branch" | "repositories" | null {
  if (!input.showGitControls) return null;
  if (input.showBranchControls === false) return "repositories";
  return input.knownRepo ? "branch" : null;
}

/**
 * Upstream's toolbar's rules for the repositories a new worktree takes (`BranchToolbar.tsx`):
 * whether it starts one, whether it offers their checklist, and its workspace picker's label.
 */
export function toolbarRepositoriesOf(input: {
  readonly showGitControls: boolean;
  readonly forceNewWorktree: boolean;
  readonly envMode: EnvMode;
  readonly worktreePath: string | null;
  readonly isServerThread: boolean;
  readonly envLocked: boolean;
  readonly tracksFolders: boolean;
}): { readonly startsNewWorktree: boolean; readonly choice: boolean; readonly workspace: string } {
  const activeWorktreePath = input.forceNewWorktree ? null : input.worktreePath;
  const effectiveEnvMode = input.forceNewWorktree ? "worktree" : input.envMode;
  const envModeLocked = input.envLocked || (input.isServerThread && activeWorktreePath !== null);
  const startsNewWorktree =
    input.showGitControls && effectiveEnvMode === "worktree" && activeWorktreePath === null;
  const workspace = input.forceNewWorktree
    ? resolveEnvModeLabel("worktree")
    : envModeLocked
      ? resolveLockedWorkspaceLabel(activeWorktreePath, effectiveEnvMode)
      : effectiveEnvMode === "worktree"
        ? resolveEnvModeLabel("worktree")
        : resolveCurrentWorkspaceLabel(activeWorktreePath);
  return {
    startsNewWorktree,
    choice: startsNewWorktree && !input.isServerThread && !envModeLocked && input.tracksFolders,
    workspace,
  };
}

/**
 * The repositories a folder offers in upstream's toolbar, with the words the ledge names it by:
 * the repositories a new worktree takes where upstream offers their checklist, else the
 * workspace, as upstream's own controls say them.
 */
export function useToolbarRepositories(input: {
  readonly environmentId: EnvironmentId;
  readonly threadId: ThreadId;
  readonly projectId: ProjectId;
  readonly draftId?: DraftId | undefined;
  readonly worktreePath: string | null;
  readonly isServerThread: boolean;
  readonly showGitControls: boolean;
  readonly envMode: EnvMode;
  readonly forceNewWorktree?: boolean | undefined;
  readonly envLocked?: boolean | undefined;
}) {
  const messages = useMessages();
  const project = useProject(scopeProjectRef(input.environmentId, input.projectId)) ?? null;
  const draftTarget = input.draftId ?? scopeThreadRef(input.environmentId, input.threadId);
  const { choices } = useWorktreeRepositoryChoices(project);
  const drafted = useComposerDraftStore(
    (store) => store.getDraftThread(draftTarget)?.worktreeRepositories,
  );
  const remembered = useRememberedWorktreeRepositories(project);
  const baseBranch = useWorktreeBaseBranch(project);
  const rules = toolbarRepositoriesOf({
    showGitControls: input.showGitControls,
    forceNewWorktree: input.forceNewWorktree === true,
    envMode: input.envMode,
    worktreePath: input.worktreePath,
    isServerThread: input.isServerThread,
    envLocked: input.envLocked === true,
    tracksFolders: (project?.trackedFolders?.length ?? 0) > 0,
  });
  const label = rules.choice
    ? resolveWorktreeRepositorySelection({ choices, chosen: drafted ?? remembered }, messages).label
    : rules.workspace;
  return { ...rules, project, draftTarget, baseBranch, label };
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
