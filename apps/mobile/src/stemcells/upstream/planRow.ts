// What a plan's row takes from upstream (stemcells/tasks/aski-orchestrator.md, decision 18): the
// composer's own model control, with the machine's catalog as the composer reads it, and the
// home rows' swipe. `planPick.ts` has the sheet the control opens.

import type { EnvironmentId, ModelSelection } from "@t3tools/contracts";
import { ProjectId } from "@t3tools/contracts";

import { buildModelOptions } from "../../lib/modelOptions";
import { useEnvironmentServerConfig } from "../../state/entities";

export { ComposerModelControl } from "../../components/ComposerModelControl";
export { ThreadSwipeable } from "../../features/home/thread-swipe-actions";

/** A model as the composer's control shows it: its entry in the machine's catalog, and its provider's driver. */
export function useModelChoice(
  environmentIdText: string,
  projectIdText: string | null,
  selection: ModelSelection | null,
) {
  const config = useEnvironmentServerConfig(environmentIdText as EnvironmentId);
  const options = buildModelOptions(
    config,
    selection,
    undefined,
    projectIdText === null ? null : ProjectId.make(projectIdText),
  );
  return {
    option:
      options.find(
        (option) =>
          option.selection.instanceId === selection?.instanceId &&
          option.selection.model === selection.model,
      ) ?? null,
    driver: config?.providers.find((provider) => provider.instanceId === selection?.instanceId)
      ?.driver,
  };
}
