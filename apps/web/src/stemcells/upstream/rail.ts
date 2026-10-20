/**
 * What the left column's rail reads from upstream: the projects in the
 * order upstream's sidebar lists them, their marks, the chats in them and
 * each chat's status, the shortcuts the rail names, and upstream's own
 * foot controls. `rail.contract.test.ts` pins what the rail relies on.
 */
import { useAtomValue } from "@effect/atom-react";
import { scopedThreadKey, scopeThreadRef } from "@t3tools/client-runtime/environment";
import { effectiveSnoozed } from "@t3tools/client-runtime/state/thread-settled";
import type { KeybindingCommand } from "@t3tools/contracts";
import {
  collectLimitAccounts,
  collectLimitPools,
  formatDuration,
  type LimitPool,
} from "@t3tools/shared/usageLimits";

import { openCommandPalette } from "../../commandPaletteBus";
import type { ProjectFaviconProject } from "../../components/ProjectFavicon";
import { isSidebarSubagentThread } from "../../components/Sidebar.logic";
import { barColor } from "../../components/usage/UsageLimits";
import { PROVIDER_PRESENTATION } from "../../components/usage/usageProviders";
import { useSidebarProjectGroups } from "../../hooks/useSidebarProjectGroups";
import { shortcutLabelForCommand } from "../../keybindings";
import { deriveProjectIdentity } from "../../projectIdentity";
import { projectIconColorClassName } from "../../projectIconColors";
import { useQuietThreadShell, useThreadShells } from "../../state/entities";
import { environmentPresentations } from "../../state/presentation";
import { primaryServerKeybindingsAtom } from "../../state/server";
import { useUiStateStore } from "../../uiStateStore";
import type { CellRef } from "../tabs/layout";
import { threadRefOf } from "./routes";
import { statusOfShell, type CellStatus } from "./status";

export { isElectron } from "../../env";

export { ProjectFavicon } from "../../components/ProjectFavicon";
export { SidebarUpdatePill } from "../../components/sidebar/SidebarUpdatePill";
export { formatDuration };

/** A project as the rail draws it: upstream's group, its mark, where its chats are. */
export interface RailProject {
  readonly key: string;
  readonly name: string;
  /** The project's own record, for upstream's mark when it is an icon or emoji. */
  readonly record: ProjectFaviconProject;
  readonly mark: RailMark;
  /** Every project of the group, as `environmentId:projectId`. */
  readonly memberKeys: ReadonlyArray<string>;
}

/** Letters in a colour (the person's, or derived from the name), or upstream's icon or emoji. */
export type RailMark =
  | { readonly kind: "letters"; readonly text: string; readonly colorClass: string }
  | { readonly kind: "icon"; readonly colorClass: string | null };

/** A chat the rail counts: open, the person's own (not a subagent's), with its status. */
export interface RailChat {
  readonly cell: CellRef;
  readonly projectKey: string;
  readonly status: CellStatus | null;
  readonly updatedAt: string;
}

export function useRailProjects(): ReadonlyArray<RailProject> {
  return useSidebarProjectGroups().map((group) => {
    const icon = group.projectIcon ?? null;
    const derived = deriveProjectIdentity(group.title);
    const mark: RailMark =
      icon?.kind === "monogram"
        ? { kind: "letters", text: icon.text, colorClass: projectIconColorClassName(icon.color) }
        : icon?.kind === "lucide"
          ? { kind: "icon", colorClass: projectIconColorClassName(icon.color) }
          : icon?.kind === "emoji"
            ? { kind: "icon", colorClass: null }
            : {
                kind: "letters",
                text: derived.monogram,
                colorClass: projectIconColorClassName(derived.color),
              };
    return {
      key: group.projectKey,
      name: group.displayName,
      record: group,
      mark,
      memberKeys: group.memberProjectRefs.map((ref) => `${ref.environmentId}:${ref.projectId}`),
    };
  });
}

/**
 * The open chats: not archived, settled or snoozed, and not a subagent's.
 * `now` decides what is still snoozed.
 */
export function useRailChats(now: string): ReadonlyArray<RailChat> {
  const shells = useThreadShells();
  const visited = useUiStateStore((state) => state.threadLastVisitedAtById);
  return shells.flatMap((shell) => {
    if (shell.archivedAt !== null || shell.settledOverride === "settled") return [];
    if (isSidebarSubagentThread(shell) || effectiveSnoozed(shell, { now })) return [];
    const cell = { environmentId: shell.environmentId, threadId: shell.id, draftId: null };
    return [
      {
        cell,
        projectKey: `${shell.environmentId}:${shell.projectId}`,
        status: statusOfShell(
          shell,
          visited[scopedThreadKey(scopeThreadRef(shell.environmentId, shell.id))],
        ),
        updatedAt: shell.updatedAt,
      },
    ];
  });
}

/** The project a chat works in, as `environmentId:projectId`; null for a draft. */
export function useCellProjectKey(cell: CellRef | null): string | null {
  const shell = useQuietThreadShell(cell ? threadRefOf(cell) : null);
  return shell ? `${shell.environmentId}:${shell.projectId}` : null;
}

/** A command's shortcut as upstream labels it ("⌘K"), or null when it has none. */
export function useShortcutLabel(command: KeybindingCommand): string | null {
  const keybindings = useAtomValue(primaryServerKeybindingsAtom);
  return shortcutLabelForCommand(keybindings, command);
}

/** Upstream's search: the command palette, which finds chats and projects. */
export function openSearch(): void {
  openCommandPalette();
}

/** Upstream's usage limits, pooled per provider as its Usage page shows them. */
export function useLimitPools(now: number): ReadonlyArray<LimitPool> {
  const presentations = useAtomValue(environmentPresentations.presentationsWithProvidersAtom);
  return collectLimitPools(collectLimitAccounts(presentations), now);
}

/** The provider's name and colour, as the Usage page draws its limits. */
export function providerLook(driver: LimitPool["driver"]): { name: string; color: string } {
  const presentation = Object.values(PROVIDER_PRESENTATION).find(
    (entry) => entry.driverKind === driver,
  );
  return { name: presentation?.label ?? String(driver), color: barColor(driver) };
}

export type { LimitPool };
