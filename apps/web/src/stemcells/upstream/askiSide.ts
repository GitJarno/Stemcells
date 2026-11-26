/**
 * What Aski's button takes from upstream (stemcells/tasks/aski-side.md): the show calls in Aski's
 * own chat, when Aski last answered, a Cell's chip in Aski's composer, and whether a chat is here.
 */
import type { EnvironmentThreadStructure } from "@t3tools/client-runtime/state/shell";
import { threadContextRecord } from "@t3tools/shared/composerContextReferences";
import { DateTime } from "effect";

import { useComposerDraftStore } from "../../composerDraftStore";
import {
  readThreadShell,
  useQuietThreadProjection,
  useQuietThreadShell,
} from "../../state/entities";
import type { ShowCall } from "../aski/side";
import type { CellRef } from "../tabs/layout";
import { threadRefOf } from "./routes";

export { requestPrimary } from "./devices";

/**
 * Aski's chat as its thread detail holds it, or null while it isn't loaded. Read only while Aski
 * is in front, whose pane already follows that detail: this asks the server for nothing more.
 */
export function useAskiThread(aski: CellRef | null): EnvironmentThreadStructure | null {
  return useQuietThreadProjection(aski ? threadRefOf(aski) : null);
}

/** The tool calls Aski's own chat made, never one a forked-from chat did. */
export function callsOf(thread: EnvironmentThreadStructure, threadId: string): ShowCall[] {
  return thread.projection.visibleTurnItems.flatMap(({ sourceThreadId, item }) =>
    sourceThreadId === threadId && item.type === "dynamic_tool"
      ? [
          {
            id: item.id,
            toolName: item.toolName,
            status: item.status,
            input: item.input,
            completedAt:
              item.completedAt === null ? null : DateTime.toEpochMillis(item.completedAt),
          },
        ]
      : [],
  );
}

/**
 * When Aski's chat last finished a reply, as upstream's sidebar reads an unseen completion:
 * null for none (or one cut short), undefined until the chat is known.
 */
export function useAskiAnsweredAt(aski: CellRef | null): string | null | undefined {
  const shell = useQuietThreadShell(aski ? threadRefOf(aski) : null);
  if (shell === null) return undefined;
  const run = shell.latestRun;
  return run?.status === "completed" ? run.completedAt : null;
}

/**
 * Puts `cell`'s chip in Aski's composer, as upstream's "Add to chat" does: at the end of the
 * draft, and never twice (upstream skips a chip already there).
 */
export function addCellChip(aski: CellRef, cell: CellRef): void {
  const ref = threadRefOf(cell);
  const shell = readThreadShell(ref);
  if (shell === null || shell.deletedAt !== null) return;
  useComposerDraftStore
    .getState()
    .addThreadContexts(threadRefOf(aski), [threadContextRecord(ref, shell.title)], {
      insertAtCaret: false,
    });
}

/** Whether this client knows the chat, and it isn't deleted. */
export function chatHere(cell: CellRef): boolean {
  const shell = readThreadShell(threadRefOf(cell));
  return shell !== null && shell.deletedAt === null;
}
