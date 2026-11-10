/**
 * A Cell's model selection on another account of its provider, for the accounts list's move
 * (`accounts/move.ts`): its model, and its options as that account's model takes them, which is
 * how upstream's own picker builds a selection (`modelSelection.ts`).
 */
import type { ModelSelection, ServerProvider } from "@t3tools/contracts";
import { createModelSelection } from "@t3tools/shared/model";

import { getComposerProviderState } from "../../components/chat/composerProviderState";
import { selectsPlanAgent } from "../../modelSelection";

/** Null when the account is gone or doesn't offer the Cell's model. */
export function selectionOnAccount(
  providers: ReadonlyArray<ServerProvider>,
  selection: ModelSelection,
  instanceId: string,
): ModelSelection | null {
  const target = providers.find((provider) => provider.instanceId === instanceId);
  if (target === undefined || !target.models.some((model) => model.slug === selection.model)) {
    return null;
  }
  const { modelOptionsForDispatch } = getComposerProviderState({
    provider: target.driver,
    model: selection.model,
    models: target.models,
    modelOptions: selection.options,
    includePlanAgent: selectsPlanAgent(selection.options),
  });
  return createModelSelection(target.instanceId, selection.model, modelOptionsForDispatch);
}
