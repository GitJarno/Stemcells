/** A chat's live status as upstream's sidebar names it, for the Cell that shows it. */
import { scopedThreadKey } from "@t3tools/client-runtime/environment";
import type { EnvironmentThreadShell } from "@t3tools/client-runtime/state/models";
import type { ScopedThreadRef } from "@t3tools/contracts";

import {
  resolveThreadLastVisitedAt,
  resolveThreadStatusPill,
  type ThreadStatusPill,
} from "../../components/Sidebar.logic";
import { useQuietThreadShell } from "../../state/entities";
import { useUiStateStore } from "../../uiStateStore";
import type { CellRef } from "../tabs/layout";
import { threadRefOf } from "./routes";

/** Every status upstream's sidebar shows a chat in, most urgent first. */
export const CELL_STATUSES = [
  "Pending Approval",
  "Awaiting Input",
  "Guest Request",
  "Failed",
  "Working",
  "Connecting",
  "Waiting",
  "Plan Ready",
  "Completed",
] as const satisfies ReadonlyArray<ThreadStatusPill["label"]>;
export type CellStatus = (typeof CELL_STATUSES)[number];

/**
 * The chat's status as upstream's sidebar shows it; null while it has none
 * (idle and seen) or is still an unsent draft.
 */
export function useCellStatus(cell: CellRef | null): CellStatus | null {
  const ref = cell ? threadRefOf(cell) : null;
  const shell = useQuietThreadShell(ref);
  const localLastVisitedAt = useUiStateStore((state) =>
    ref ? state.threadLastVisitedAtById[scopedThreadKey(ref)] : undefined,
  );
  return shell === null ? null : statusOfShell(shell, localLastVisitedAt);
}

/** Whether the chat is working now, as upstream's sidebar shows it. */
export function useChatWorking(ref: ScopedThreadRef | null): boolean {
  const shell = useQuietThreadShell(ref);
  return shell !== null && statusOfShell(shell, undefined) === "Working";
}

/** One thread's status from its shell and the last visit this browser saw. */
export function statusOfShell(
  shell: EnvironmentThreadShell,
  localLastVisitedAt: string | undefined,
): CellStatus | null {
  const lastVisitedAt = resolveThreadLastVisitedAt(shell.lastVisitedAt, localLastVisitedAt);
  return resolveThreadStatusPill({ thread: { ...shell, lastVisitedAt } })?.label ?? null;
}
