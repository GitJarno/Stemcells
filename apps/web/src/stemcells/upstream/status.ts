/** A chat's live status as upstream's sidebar names it, for the Cell that shows it. */
import { scopedThreadKey } from "@t3tools/client-runtime/environment";

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
  if (shell === null) return null;
  const lastVisitedAt = resolveThreadLastVisitedAt(shell.lastVisitedAt, localLastVisitedAt);
  return resolveThreadStatusPill({ thread: { ...shell, lastVisitedAt } })?.label ?? null;
}
