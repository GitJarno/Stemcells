/**
 * Settles a Cell as upstream's sidebar does, via our substitute so its pane closes, with the
 * "Settled" notice whose Undo restores its pin and snooze. From any stage
 * (stemcells/tasks/left-column.md, decision 2): upstream refuses a thread that runs or waits on
 * an answer, so a Cell at work stops first. A queued message still refuses: it's the person's.
 */
import { scopeThreadRef } from "@t3tools/client-runtime/environment";
import { runAtomCommand } from "@t3tools/client-runtime/state/runtime";
import type { EnvironmentThreadShell } from "@t3tools/client-runtime/state/shell";
import type { EnvironmentId, ScopedThreadRef, ThreadId } from "@t3tools/contracts";

import { stackedThreadToast, toastManager } from "~/components/ui/toast";
import { appAtomRegistry } from "~/rpc/atomRegistry";
import { readThreadShell } from "~/state/entities";
import { environmentThreadShells, threadEnvironment } from "~/state/threads";
import { waitForAtomValue } from "~/state/waitForAtomValue";

import { useThreadActions } from "./substitutes/useThreadActions";

const RUNNING = new Set(["preparing", "starting", "running", "waiting"]);

/** How long a stopped Cell has to end its run before its settle gives up. */
const STOP_WAIT_MS = 15_000;

const runs = (shell: EnvironmentThreadShell | null): boolean =>
  shell !== null && RUNNING.has(shell.source.status);

/** At work, or waiting on an answer that holds its run. */
const atWork = (shell: EnvironmentThreadShell | null): boolean => {
  const asking = shell?.source.pendingRuntimeRequest ?? null;
  return runs(shell) || (asking !== null && asking.blocking !== false);
};

/** Stops the Cell's turn, and waits for its run to end; false when it doesn't. */
async function stop(ref: ScopedThreadRef): Promise<boolean> {
  const result = await runAtomCommand(
    appAtomRegistry,
    threadEnvironment.interruptTurn,
    { environmentId: ref.environmentId, input: { threadId: ref.threadId } },
    { reportFailure: false },
  );
  if (result._tag !== "Success") return false;
  return waitForAtomValue({
    registry: appAtomRegistry,
    atom: environmentThreadShells.threadShellAtom(ref),
    predicate: (shell) => !runs(shell),
    timeoutMs: STOP_WAIT_MS,
  });
}

/** Settles `ref`, stopping it first when it is at work; true once the settle is accepted. */
export async function settleFromAnyStage(
  ref: ScopedThreadRef,
  settleThread: ReturnType<typeof useThreadActions>["settleThread"],
): Promise<boolean> {
  if (atWork(readThreadShell(ref)) && !(await stop(ref))) {
    toastManager.add(
      stackedThreadToast({
        type: "error",
        title: "Couldn't stop it to settle it",
        description: "Settle it once it has stopped.",
      }),
    );
    return false;
  }
  const result = await settleThread(ref);
  return result._tag === "Success";
}

export function useSettleCell(): (cell: {
  readonly environmentId: string;
  readonly threadId: string;
}) => Promise<boolean> {
  const { settleThread } = useThreadActions();
  return (cell) =>
    settleFromAnyStage(
      scopeThreadRef(cell.environmentId as EnvironmentId, cell.threadId as ThreadId),
      settleThread,
    );
}
