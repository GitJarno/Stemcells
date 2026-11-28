// The sheet the composer's model control opens, for a plan's row
// (stemcells/tasks/aski-orchestrator.md, decision 18): upstream's picker screen, its sheet's
// route, and the catalog and options it is handed, as the composer's own sheet builds them.

import type { EnvironmentId, ModelSelection } from "@t3tools/contracts";
import { ProjectId } from "@t3tools/contracts";

import { buildModelOptions, groupByProvider } from "../../lib/modelOptions";
import { resolveProviderOptionDescriptors } from "../../lib/providerOptions";
import { useEnvironmentServerConfig } from "../../state/entities";

export type { ModelSelection, ProviderOptionSelection } from "@t3tools/contracts";
export { ThreadSettingsPickerScreen } from "../../features/threads/ThreadSettingsSheet";
export { sheetRoute } from "../../features/layout/route-options";

/**
 * What the picker is handed for `selection`: the machine's models by provider, and of the
 * model's options the one named `keeps` alone, since a plan's Cell carries its model and effort.
 */
export function usePickCatalog(
  environmentIdText: string,
  projectIdText: string | null,
  selection: ModelSelection | null,
  keeps: string | undefined,
) {
  const environmentId = environmentIdText as EnvironmentId;
  const projectId = projectIdText === null ? null : ProjectId.make(projectIdText);
  const config = useEnvironmentServerConfig(environmentId);
  const options = buildModelOptions(config, selection, undefined, projectId);
  const current = options.find(
    (option) =>
      option.selection.instanceId === selection?.instanceId &&
      option.selection.model === selection.model,
  );
  return {
    environmentId,
    projectId,
    providerGroups: groupByProvider(options),
    optionDescriptors: resolveProviderOptionDescriptors({
      capabilities: current?.capabilities,
      selections: selection?.options,
    }).filter((descriptor) => descriptor.id === keeps),
  };
}
