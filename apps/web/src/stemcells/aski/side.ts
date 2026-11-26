// Aski's button on the Mac (stemcells/tasks/aski-side.md): where one turn goes, which of Aski's
// show calls a window acts on, and the next Cell waiting on the person.
import {
  isShowTool,
  mayShow,
  showOfInput,
  type AskiShow,
  type ShowGate,
} from "../../../../../stemcells/aski/show.ts";
import { ASKI_TAB_ID } from "../tabs/askiTab";
import type { Workspace } from "../tabs/layout";

/**
 * Where a turn goes: to Aski from a Cell's tab (or none), and from Aski back to the tab it was
 * turned to from, else the first Cell's. Null from Aski with no Cell to go back to.
 */
export function askiTurnTarget(workspace: Workspace, cameFrom: string | null): string | null {
  if (workspace.activeTabId !== ASKI_TAB_ID) return ASKI_TAB_ID;
  const cells = workspace.tabs.filter((tab) => tab.id !== ASKI_TAB_ID);
  return (cells.find((tab) => tab.id === cameFrom) ?? cells[0])?.id ?? null;
}

/** A tool call in Aski's own chat. */
export interface ShowCall {
  readonly id: string;
  readonly toolName: string | null;
  readonly status: string;
  readonly input: unknown;
  /** Epoch milliseconds; null until it completes. */
  readonly completedAt: number | null;
}

const doneShow = (call: ShowCall) => call.status === "completed" && isShowTool(call.toolName);

/**
 * The completed show calls not handled yet, and every one handled after. `handled` null is the
 * chat as it first loads, or as it comes back in front: what is there already is let go.
 */
export function newShowCalls(
  calls: ReadonlyArray<ShowCall>,
  handled: ReadonlySet<string> | null,
): { readonly fresh: ReadonlyArray<ShowCall>; readonly handled: ReadonlySet<string> } {
  const done = calls.filter(doneShow);
  if (handled === null) return { fresh: [], handled: new Set(done.map((call) => call.id)) };
  const fresh = done.filter((call) => !handled.has(call.id));
  if (fresh.length === 0) return { fresh, handled };
  return { fresh, handled: new Set([...handled, ...fresh.map((call) => call.id)]) };
}

/**
 * What a completed show call shows on Aski's machine `environmentId`, if this window may turn to
 * it now (`mayShow`): a Cell only while this client has it.
 */
export function showToAct(
  call: ShowCall,
  environmentId: string,
  gate: ShowGate,
  chatHere: (threadId: string) => boolean,
): AskiShow | null {
  if (call.completedAt === null) return null;
  const show = showOfInput(call.input, environmentId);
  if (show === null || !mayShow({ id: call.id, at: call.completedAt, show }, gate)) return null;
  return show.kind === "cell" && !chatHere(show.threadId) ? null : show;
}

/** The first Cell waiting on the person among the needs, and how many wait; never Aski's own. */
export function nextOnInput(
  needs: ReadonlyArray<{ readonly threadId: string }> | null,
  askiThreadId: string | null,
): { readonly threadId: string; readonly count: number } | null {
  const waiting = [
    ...new Set((needs ?? []).map((need) => need.threadId).filter((id) => id !== askiThreadId)),
  ];
  return waiting.length === 0 ? null : { threadId: waiting[0]!, count: waiting.length };
}
