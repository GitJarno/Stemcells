/**
 * Upstream's chat header jobs, for the line over a Cell's composer in a pane: the thread's menu
 * and rename, a new chat in its project, the way back to its parent, and where it runs. Each is
 * upstream's own code or its header ported as is; `chatHeader.contract.test.ts` pins it.
 */
import { useAtomValue } from "@effect/atom-react";
import { scopeProjectRef } from "@t3tools/client-runtime/environment";
import {
  isAtomCommandInterrupted,
  squashAtomCommandFailure,
} from "@t3tools/client-runtime/state/runtime";
import {
  AuthOrchestrationOperateScope,
  type EnvironmentId,
  type EnvironmentMachineKind,
} from "@t3tools/contracts";
import { Atom } from "effect/reactivity";
import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";

import {
  type EnvironmentOption,
  resolveLockedWorkspaceLabel,
  shouldShowEnvironmentIndicator,
} from "../../components/BranchToolbar.logic";
import { resolveRenameCommit } from "../../components/chat/ChatHeader";
import { canShareWithGuestAtom } from "../../components/chat/guestShareAvailability";
import type { ProjectFaviconProject } from "../../components/ProjectFavicon";
import { isTrailingDoubleClick } from "../../components/Sidebar.logic";
import { toastManager } from "../../components/ui/toast";
import { useLogicalProjectEnvironments } from "../../hooks/useLogicalProjectEnvironments";
import { useNewThreadHandler } from "../../hooks/useHandleNewThread";
import { useClientSettings } from "../../hooks/useSettings";
import { useThreadActionMenu } from "../../hooks/useThreadActionMenu";
import { useProject, useQuietThreadShell } from "../../state/entities";
import { readEnvironmentScope, useEnvironmentScope } from "../../state/session";
import { threadEnvironment } from "../../state/threads";
import { useOrchestrationCommand } from "../../state/use-orchestration-command";
import type { CellRef } from "../tabs/layout";
import { threadRefOf } from "./routes";

export { EnvironmentMachineIcon } from "../../components/EnvironmentMachineIcon";
export { ProjectFavicon } from "../../components/ProjectFavicon";

/**
 * How long a click on the title waits before opening the menu, so a
 * double-click can rename instead; as upstream's header waits, and only
 * where the menu is the desktop's own (it holds input while open).
 */
const TITLE_MENU_OPEN_DELAY_MS = 500;

/** Why a chat's new title wasn't applied: it isn't loaded here, or this window may not change it. */
export const CANT_RENAME_CELL = "Can't rename this Cell here";

/**
 * Renames the chat as upstream's header does: an empty title is refused with a word, the same
 * title does nothing, a failure says so; every window takes the new title from the thread.
 * `commitRename` says why when it couldn't apply the title at all (chat not loaded here, or
 * this window may not change it), so what was typed isn't dropped unsaid.
 */
function useCellRename(cell: CellRef | null) {
  const threadRef = cell ? threadRefOf(cell) : null;
  const shell = useQuietThreadShell(threadRef);
  const canOperate = useEnvironmentScope(
    shell?.environmentId ?? null,
    AuthOrchestrationOperateScope,
  );
  const updateThreadMetadata = useOrchestrationCommand(threadEnvironment.updateMetadata, {
    reportFailure: false,
  });
  const commitRename = (title: string): string | undefined => {
    if (!shell || !readEnvironmentScope(shell.environmentId, AuthOrchestrationOperateScope)) {
      return CANT_RENAME_CELL;
    }
    const resolution = resolveRenameCommit({ title, originalTitle: shell.title });
    if (resolution.action === "reject-empty") {
      toastManager.add({ type: "warning", title: "Thread title cannot be empty" });
      return undefined;
    }
    if (resolution.action === "noop") return undefined;
    void updateThreadMetadata({
      environmentId: shell.environmentId,
      input: { threadId: shell.id, title: resolution.title },
    }).then((result) => {
      if (result._tag === "Failure" && !isAtomCommandInterrupted(result)) {
        const error = squashAtomCommandFailure(result);
        toastManager.add({
          type: "error",
          title: "Failed to rename thread",
          description: error instanceof Error ? error.message : "An error occurred.",
        });
      }
    });
    return undefined;
  };
  return { shell, canRename: canOperate && shell !== null, commitRename };
}

const NO_CHAT = Atom.make(false);

/**
 * The chat's thread menu and rename, as upstream's header gives them from
 * its title: a click opens the menu under what was clicked, a double-click
 * renames, a right-click opens the menu at the pointer.
 */
export function useCellThreadMenu(cell: CellRef | null) {
  const threadRef = cell ? threadRefOf(cell) : null;
  const { shell, canRename, commitRename: rename } = useCellRename(cell);
  const project = useProject(shell ? scopeProjectRef(shell.environmentId, shell.projectId) : null);
  const [renamingKey, setRenamingKey] = useState<string | null>(null);
  const key = shell ? `${shell.environmentId}:${shell.id}` : null;
  const renaming = canRename && key !== null && renamingKey === key;
  // "Share with guest", where upstream's header offers it.
  const canShareWithGuest = useAtomValue(
    threadRef ? canShareWithGuestAtom(threadRef.environmentId) : NO_CHAT,
  );

  const startRename = () => {
    if (!shell || !readEnvironmentScope(shell.environmentId, AuthOrchestrationOperateScope)) return;
    setRenamingKey(`${shell.environmentId}:${shell.id}`);
  };
  const cancelRename = () => setRenamingKey(null);
  const commitRename = (title: string): string | undefined => {
    const refused = rename(title);
    if (refused === undefined) setRenamingKey(null);
    return refused;
  };

  const { openMenu, closeMenu } = useThreadActionMenu({
    threadRef: shell ? threadRef : null,
    projectCwd: project?.workspaceRoot ?? null,
    onStartRename: startRename,
    canShareWithGuest,
  });
  const pending = useRef<number | null>(null);
  const cancelPendingMenu = () => {
    if (pending.current === null) return;
    clearTimeout(pending.current);
    pending.current = null;
  };
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Cancel the menu's pending double-click wait when the chat changes or the line unmounts.
  useEffect(
    () => () => {
      if (pending.current === null) return;
      clearTimeout(pending.current);
      pending.current = null;
    },
    // oxlint-disable-next-line react/exhaustive-effect-dependencies -- A pending menu belongs to the chat that was clicked, so another chat drops it.
    [key],
  );

  /** Opens the menu under the clicked element, after the double-click wait where there is one. */
  const onClick = (event: ReactMouseEvent<HTMLElement>) => {
    if (isTrailingDoubleClick(event.detail)) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const open = () => {
      pending.current = null;
      openMenu({ x: rect.left, y: rect.bottom + 4 });
    };
    cancelPendingMenu();
    if (event.detail === 0 || window.desktopBridge === undefined) open();
    else pending.current = window.setTimeout(open, TITLE_MENU_OPEN_DELAY_MS);
  };
  const onDoubleClick = (event: ReactMouseEvent<HTMLElement>) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    cancelPendingMenu();
    closeMenu();
    startRename();
  };
  const onContextMenu = (event: ReactMouseEvent<HTMLElement>) => {
    if (renaming || !shell) return;
    cancelPendingMenu();
    event.preventDefault();
    openMenu({ x: event.clientX, y: event.clientY });
  };

  return {
    title: shell?.title ?? null,
    renaming,
    onClick,
    onDoubleClick: canRename ? onDoubleClick : undefined,
    onBlur: cancelPendingMenu,
    onContextMenu,
    commitRename,
    cancelRename,
  };
}

/**
 * The chat's project, for its mark and for starting a new chat in it, as
 * upstream's header does from the project's name. Null while the chat is a
 * draft.
 */
export function useCellProject(cell: CellRef | null): {
  readonly record: ProjectFaviconProject;
  readonly startNewChat: () => void;
} | null {
  const shell = useQuietThreadShell(cell ? threadRefOf(cell) : null);
  const projectRef = shell ? scopeProjectRef(shell.environmentId, shell.projectId) : null;
  const project = useProject(projectRef);
  const handleNewThread = useNewThreadHandler();
  if (project === null || projectRef === null) return null;
  return { record: project, startNewChat: () => void handleNewThread(projectRef) };
}

/** The chat a subagent's chat was started from, as upstream's header links it. */
export function useCellParent(cell: CellRef | null): {
  readonly cell: CellRef;
  readonly title: string;
} | null {
  const shell = useQuietThreadShell(cell ? threadRefOf(cell) : null);
  const parentId =
    shell?.lineage.relationshipToParent === "subagent" ? shell.lineage.parentThreadId : null;
  const parentCell =
    shell && parentId
      ? { environmentId: shell.environmentId, threadId: parentId, draftId: null }
      : null;
  const parent = useQuietThreadShell(parentCell ? threadRefOf(parentCell) : null);
  if (parentCell === null) return null;
  return { cell: parentCell, title: parent?.title ?? "Parent Cell" };
}

/** Where a chat runs, as the line marks it. */
export interface RunsOn {
  readonly machine: { readonly kind: EnvironmentMachineKind; readonly label: string } | null;
  readonly worktree: { readonly label: string; readonly branch: string | null } | null;
}

/**
 * Where a sent chat runs, where upstream's context strip would say it: the machine when
 * upstream would name it (another machine's, or the project is on several), and a worktree, in
 * upstream's words. Nothing for the project's own checkout here. Null while the person keeps
 * upstream's strip under every chat, which says it there.
 */
export function useCellRunsOn(cell: CellRef | null): RunsOn | null {
  const shell = useQuietThreadShell(cell ? threadRefOf(cell) : null);
  const project = useProject(shell ? scopeProjectRef(shell.environmentId, shell.projectId) : null);
  const environments = useLogicalProjectEnvironments(project, false);
  const stripKept = useClientSettings((settings) => settings.persistComposerContextStrip);
  return shell === null || stripKept ? null : runsOnOf(shell, environments);
}

/** `useCellRunsOn`'s answer, from the chat and the machines its project is on. */
export function runsOnOf(
  chat: {
    readonly environmentId: EnvironmentId;
    readonly worktreePath: string | null;
    readonly branch: string | null;
  },
  environments: ReadonlyArray<EnvironmentOption>,
): RunsOn | null {
  const environment = environments.find((env) => env.environmentId === chat.environmentId) ?? null;
  const machine =
    environment &&
    shouldShowEnvironmentIndicator({
      activeEnvironment: environment,
      canPickEnvironment: environments.length > 1,
    })
      ? { kind: environment.machine, label: environment.label }
      : null;
  const worktree = chat.worktreePath
    ? { label: resolveLockedWorkspaceLabel(chat.worktreePath, "worktree"), branch: chat.branch }
    : null;
  return machine || worktree ? { machine, worktree } : null;
}
