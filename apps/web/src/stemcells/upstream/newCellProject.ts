/**
 * Which project a new Cell starts in. The column's New Cell starts in the project the column
 * shows, as upstream's sidebar New starts in the project it is filtered to; from a chat of that
 * project on another machine, on that machine. Otherwise, where upstream's new thread would.
 */
import { resolveScopedNewThreadProjectRef } from "../../components/Sidebar.logic";
import type { SidebarProjectSnapshot } from "../../sidebarProjectGrouping";
// Ours, as upstream's "new thread" gets it (`substitutes/plugin.ts`): this folder gets upstream's.
import {
  type ChatThreadActionContext,
  resolveThreadActionProjectRef,
} from "./substitutes/chatThreadActions";

/** A project the column shows: upstream's project group, which may span machines. */
export type NewCellScope = Pick<
  SidebarProjectSnapshot,
  "environmentId" | "id" | "memberProjectRefs"
>;

export function newCellProjectRef(
  scope: NewCellScope | null,
  context: ChatThreadActionContext,
): ReturnType<typeof resolveThreadActionProjectRef> {
  return (
    resolveScopedNewThreadProjectRef({
      shiftKey: false,
      scopedProjectGroups: scope === null ? [] : [scope],
      viewed: context.activeThread ?? context.activeDraftThread,
    }) ?? resolveThreadActionProjectRef(context)
  );
}
