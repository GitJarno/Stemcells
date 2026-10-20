/** Upstream's chat routes, as Cells: the URL names a thread or a draft. */
import { scopeThreadRef } from "@t3tools/client-runtime/environment";
import type { EnvironmentId, ThreadId } from "@t3tools/contracts";
import { useLocation, useNavigate } from "@tanstack/react-router";

import type { DraftId } from "../../composerDraftStore";
import type { ThreadRouteTarget } from "../../threadRoutes";
import type { CellRef } from "../tabs/layout";

export type { ThreadRouteTarget } from "../../threadRoutes";
export { useThreadRouteTarget } from "../../hooks/useThreadRouteTarget";

export function threadRefOf(cell: CellRef) {
  return scopeThreadRef(cell.environmentId as EnvironmentId, cell.threadId as ThreadId);
}

export function routeTargetForCell(cell: CellRef): ThreadRouteTarget {
  return cell.draftId === null
    ? { kind: "server", threadRef: threadRefOf(cell) }
    : { kind: "draft", draftId: cell.draftId as DraftId };
}

export function useNavigateToCell() {
  const navigate = useNavigate();
  return (cell: CellRef, options: { replace?: boolean } = {}) =>
    void (cell.draftId === null
      ? navigate({
          to: "/$environmentId/$threadId",
          params: { environmentId: cell.environmentId, threadId: cell.threadId },
          replace: options.replace ?? false,
        })
      : navigate({
          to: "/draft/$draftId",
          params: { draftId: cell.draftId },
          replace: options.replace ?? false,
        }));
}

/** The index route, where upstream starts a draft for the most recent project. */
export function useIsIndexRoute(): boolean {
  return useLocation({ select: (location) => location.pathname === "/" });
}
