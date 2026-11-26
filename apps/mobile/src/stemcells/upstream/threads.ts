// What the phone's Cells and home read of a chat, from modules Node can load (no views), so the
// logic over them is tested as it runs: its shell, T3's status for it, its snooze, its flight's
// start, an unseen landing, and how T3 scopes the home's list by project and names its filter.
// `cells.ts` hands these on to the views.

export type { EnvironmentThreadShell } from "@t3tools/client-runtime/state/shell";
export type { EnvironmentProject } from "@t3tools/client-runtime/state/shell";
export { EnvironmentId, type SidebarProjectGroupingMode } from "@t3tools/contracts";
export type { ThreadListFilters } from "../../persistence/mobile-preferences";
export type { AppBarAction, AppBarMenu, AppBarMenuItem } from "../../components/ui/AppBar.types";
export { effectiveSnoozed } from "@t3tools/client-runtime/state/thread-settled";
export { parseThreadLinkHref } from "@t3tools/shared/threadLinks";
export {
  resolveThreadListV2Status,
  threadHasUnseenCompletion,
  type ThreadListV2Status,
} from "../../features/threads/threadListV2";
export { resolveThreadWorkingStartedAt } from "@t3tools/client-runtime/state/models";
export { buildHomeProjectScopes, findHomeProjectScope } from "../../features/home/homeThreadList";
