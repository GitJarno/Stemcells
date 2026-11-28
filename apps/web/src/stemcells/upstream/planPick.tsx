/**
 * A plan row's model and effort, picked with the composer's own control (`aski/plan/PlanRow.tsx`;
 * aski-orchestrator.md, decision 18): T3's picker with its docked effort column. A plan's Cell
 * carries its model and one effort, so the column is handed the effort levels and nothing else.
 */
import { REASONING_EFFORT_OPTION_IDS } from "@t3tools/client-runtime/state/thread-execution";
import type { EnvironmentId, ProviderInstanceId, ServerProvider } from "@t3tools/contracts";
import { useMessages } from "gt-react";

import {
  ComposerEffortColumn,
  describeComposerEffort,
} from "../../components/chat/ComposerModelEffort";
import { ProviderModelPicker } from "../../components/chat/ProviderModelPicker";
import type { TraitsSelectionInput } from "../../components/chat/TraitsPicker";
import { useEnvironmentSettings } from "../../hooks/useSettings";
import { getCustomModelOptionsByInstance } from "../../modelSelection";
import { providerInstanceEntriesFor } from "../../providerInstances";
import { useEnvironmentProviders } from "../../state/environments";
import { isAskisInstance } from "../aski/setup";
import { conciseModelName } from "../models/names";

/** A model as a plan's Cell starts on it. */
export interface PlanModel {
  readonly instanceId: string;
  readonly id: string;
  /** The effort option and level a launch sends; null for the model's own. */
  readonly effort: { readonly option: string; readonly level: string } | null;
}

/** What the person picked: the model by its name too, as the plan's row writes it. */
export interface PlanModelPicked extends PlanModel {
  readonly name: string;
}

const NO_PROVIDERS: ReadonlyArray<ServerProvider> = [];

const isEffort = (id: string): boolean =>
  (REASONING_EFFORT_OPTION_IDS as ReadonlyArray<string>).includes(id);

/** A provider's models with their effort levels as their only option. */
const effortOnly = (models: ServerProvider["models"]): ServerProvider["models"] =>
  models.map((model) =>
    model.capabilities?.optionDescriptors === undefined
      ? model
      : {
          ...model,
          capabilities: {
            ...model.capabilities,
            optionDescriptors: model.capabilities.optionDescriptors.filter(
              (descriptor) => descriptor.type === "select" && isEffort(descriptor.id),
            ),
          },
        },
  );

export function PlanModelPick(props: {
  /** Aski's server: a plan's Cell starts on one of its agents. */
  readonly environmentId: string;
  /** The model as it stands; null when no agent can start a Cell. */
  readonly model: PlanModel | null;
  readonly onPick: (model: PlanModelPicked) => void;
}) {
  const environmentId = props.environmentId as EnvironmentId;
  const settings = useEnvironmentSettings(environmentId);
  const messages = useMessages();
  // Aski's instance is Aski's: no Cell starts on it (`cellInstance.ts`).
  const providers = (useEnvironmentProviders().get(environmentId) ?? NO_PROVIDERS).filter(
    (provider) => !isAskisInstance(provider.instanceId),
  );
  const entries = providerInstanceEntriesFor(providers, settings, null);
  const instanceId = (props.model?.instanceId ??
    entries[0]?.instanceId ??
    "") as ProviderInstanceId;
  const slug = props.model?.id ?? "";
  const entry = entries.find((each) => each.instanceId === instanceId);
  const nameOf = (instance: string, model: string) =>
    conciseModelName(
      entries
        .find((each) => each.instanceId === instance)
        ?.models.find((each) => each.slug === model)?.name ?? model,
    );
  const effort = props.model?.effort ?? null;
  const traits: TraitsSelectionInput | null =
    entry === undefined || props.model === null
      ? null
      : {
          provider: entry.driverKind,
          instanceId,
          models: effortOnly(entry.models),
          model: slug,
          modelOptions: effort === null ? [] : [{ id: effort.option, value: effort.level }],
          // The words are the person's own, sent as they are: no level is written into them.
          allowPromptInjectedEffort: false,
          onModelOptionsChange: (options) => {
            const level = options?.find(
              (option) => isEffort(option.id) && typeof option.value === "string",
            );
            props.onPick({
              instanceId,
              id: slug,
              name: nameOf(instanceId, slug),
              effort: level === undefined ? null : { option: level.id, level: String(level.value) },
            });
          },
        };
  const shown = describeComposerEffort(traits, settings.effortDisplay, "xs", messages);
  return (
    <ProviderModelPicker
      environmentId={environmentId}
      activeInstanceId={instanceId}
      model={slug}
      lockedProvider={null}
      instanceEntries={entries}
      modelOptionsByInstance={getCustomModelOptionsByInstance(
        settings,
        providers,
        instanceId,
        slug,
      )}
      isComposerOwned={false}
      size="xs"
      popupAlign="end"
      triggerSuffix={shown.suffix}
      triggerDetail={shown.detail}
      effortColumn={<ComposerEffortColumn traits={traits} />}
      // Another model starts on its own effort: a level belongs to the model it was picked for.
      onInstanceModelChange={(instance, model) =>
        props.onPick({
          instanceId: instance,
          id: model,
          name: nameOf(instance, model),
          effort: null,
        })
      }
    />
  );
}
