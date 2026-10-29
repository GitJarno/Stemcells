// What the phone's Cells and home read of a chat, from modules Node can load
// (no views), so the logic over them is tested as it runs: a chat's shell,
// the status T3's list gives it, whether it is snoozed, and how T3 scopes the
// home's list by project. `cells.ts` hands these on to the views.

export type { EnvironmentThreadShell } from "@t3tools/client-runtime/state/shell";
export type { EnvironmentProject } from "@t3tools/client-runtime/state/shell";
export { effectiveSnoozed } from "@t3tools/client-runtime/state/thread-settled";
export {
  resolveThreadListV2Status,
  type ThreadListV2Status,
} from "../../features/threads/threadListV2";
export { buildHomeProjectScopes, findHomeProjectScope } from "../../features/home/homeThreadList";
