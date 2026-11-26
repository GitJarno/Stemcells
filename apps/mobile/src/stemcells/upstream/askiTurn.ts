// What Aski's button takes from upstream (stemcells/tasks/aski-side.md): the screen's layout, the
// glass its floating controls stand on, the press menu, a thread's chip in a composer's draft,
// Aski's chat's turn items, and a new Cell's draft.

import { useAtomValue } from "@effect/atom-react";
import { scopedThreadKey, scopeThreadRef } from "@t3tools/client-runtime/environment";
import type { EnvironmentId, OrchestrationV2ThreadProjection, ThreadId } from "@t3tools/contracts";
import * as DateTime from "effect/DateTime";
import { Atom } from "effect/reactivity";
import {
  formatComposerContextReference,
  threadContextRecord,
} from "@t3tools/shared/composerContextReferences";

import { useAdaptiveWorkspaceLayout } from "../../features/layout/adaptive-workspace-context";
import {
  getComposerDraftSnapshot,
  insertComposerDraftContext,
  setComposerDraftContext,
  setComposerDraftText,
} from "../../state/use-composer-drafts";
import { environmentThreadDetails } from "../../state/threads";

export { GlassSurface } from "../../components/ui/GlassSurface";
export { Menu } from "../../components/ui/Menu";
export * as Dialog from "../../components/ui/Dialog";
export { SymbolView } from "../../components/ui/AppSymbol";
export { useDeviceType, useNativeLayoutMetrics } from "../../native/native-layout-metrics";

/**
 * Puts the chip of the Cell `from` in Aski's composer: Aski reads it as what "this" means. Only
 * into a draft with nothing in it but an earlier carried chip, which it replaces: words the
 * person wrote are theirs.
 */
export function carryChip(
  aski: { readonly environmentId: string; readonly threadId: string },
  from: { readonly environmentId: string; readonly threadId: string; readonly title: string },
): void {
  const draftKey = scopedThreadKey(
    scopeThreadRef(aski.environmentId as EnvironmentId, aski.threadId as ThreadId),
  );
  const record = threadContextRecord(
    {
      environmentId: from.environmentId as EnvironmentId,
      threadId: from.threadId as ThreadId,
    },
    from.title,
  );
  const draft = getComposerDraftSnapshot(draftKey);
  const records = draft.context?.records ?? [];
  if (records.some((each) => each.contextId === record.contextId)) return;
  const carried = records.length === 1 && records[0]!.kind === "thread" ? records[0]! : null;
  const onlyCarried =
    carried !== null && draft.text.trim() === formatComposerContextReference(carried).trim();
  if (draft.attachments.length > 0 || (draft.text.trim().length > 0 && !onlyCarried)) return;
  if (onlyCarried) {
    setComposerDraftText(draftKey, "");
    setComposerDraftContext(draftKey, undefined);
  }
  insertComposerDraftContext(draftKey, {
    text: formatComposerContextReference(record),
    context: { version: 1, records: [record] },
  });
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
