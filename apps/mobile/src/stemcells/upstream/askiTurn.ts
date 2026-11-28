// What Aski's button takes from upstream (stemcells/tasks/aski-side.md): the screen's layout, the
// glass its floating controls stand on, the press menu, a thread's chip in a composer's draft,
// Aski's chat's turn items, and a new Cell's draft.

import { useAtomValue } from "@effect/atom-react";
import type { EnvironmentId, OrchestrationV2ThreadProjection, ThreadId } from "@t3tools/contracts";
import * as DateTime from "effect/DateTime";
import { Atom } from "effect/reactivity";
import {
  formatComposerContextReference,
  threadContextRecord,
} from "@t3tools/shared/composerContextReferences";

import { useAdaptiveWorkspaceLayout } from "../../features/layout/adaptive-workspace-context";
import { appAtomRegistry } from "../../state/atom-registry";
import {
  getComposerDraftSnapshot,
  insertComposerDraftContext,
  setComposerDraftText,
} from "../../state/use-composer-drafts";
import { environmentThreadDetails, environmentThreadShells } from "../../state/threads";
import { takesCell } from "../aski/carried";

export { GlassSurface } from "../../components/ui/GlassSurface";
export { Menu } from "../../components/ui/Menu";
export * as Dialog from "../../components/ui/Dialog";
export { SymbolView } from "../../components/ui/AppSymbol";
export { useDeviceType, useNativeLayoutMetrics } from "../../native/native-layout-metrics";
export { NativeWorkspaceTabActivityContext } from "../../native/v5-workspace-context";

/**
 * Puts the chip of the Cell `from` at the head of a draft as it is sent: Aski reads it as what
 * "this" means. Answers how to take it out again should the message not go; null when it has no
 * place (`takesCell`) or the Cell is gone. `askiTurn.contract.test.ts` pins what this leans on.
 */
export function attachCell(
  draftKey: string,
  from: { readonly environmentId: string; readonly threadId: string },
): (() => void) | null {
  const cell = appAtomRegistry
    .get(environmentThreadShells.threadShellsAtom)
    .find((shell) => shell.environmentId === from.environmentId && shell.id === from.threadId);
  const before = getComposerDraftSnapshot(draftKey);
  if (cell === undefined || !takesCell(before.text)) return null;
  const record = threadContextRecord(
    { environmentId: cell.environmentId, threadId: cell.id },
    cell.title,
  );
  if (before.context?.records.some((each) => each.contextId === record.contextId)) return null;
  const went = insertComposerDraftContext(
    draftKey,
    { text: formatComposerContextReference(record), context: { version: 1, records: [record] } },
    { text: before.text, start: 0, end: 0 },
  );
  if (!went) return null;
  const attached = getComposerDraftSnapshot(draftKey).text;
  return () => {
    // Taking the reference out of the text takes its record with it.
    if (getComposerDraftSnapshot(draftKey).text === attached)
      setComposerDraftText(draftKey, before.text);
  };
}

export interface ToolCall {
  readonly id: string;
  readonly toolName: string | null;
  readonly input: unknown;
  readonly status: string;
  /** Epoch milliseconds. */
  readonly completedAt: number | null;
}

const NO_CALLS: ReadonlyArray<ToolCall> = [];
const NO_ITEMS = Atom.make<OrchestrationV2ThreadProjection["visibleTurnItems"]>(
  Object.freeze([]),
).pipe(Atom.withLabel("stemcells-aski-items:none"));

/** The tool calls in a chat's visible items, while its detail is held (it is, in front). */
export function useToolCalls(
  chat: {
    readonly environmentId: string;
    readonly threadId: string;
  } | null,
): ReadonlyArray<ToolCall> {
  const rows = useAtomValue(
    chat === null
      ? NO_ITEMS
      : environmentThreadDetails.visibleTurnItemsAtom({
          environmentId: chat.environmentId as EnvironmentId,
          threadId: chat.threadId as ThreadId,
        }),
  );
  if (chat === null) return NO_CALLS;
  const calls: ToolCall[] = [];
  for (const row of rows) {
    const item = row.item;
    if (item.type !== "dynamic_tool") continue;
    calls.push({
      id: item.id,
      toolName: item.toolName,
      input: item.input,
      status: item.status,
      completedAt: item.completedAt === null ? null : DateTime.toEpochMillis(item.completedAt),
    });
  }
  return calls;
}

/** Starts a new Cell's draft as the compose button does. */
export function useStartNewCell(): () => void {
  return useAdaptiveWorkspaceLayout().startNewTask;
}
