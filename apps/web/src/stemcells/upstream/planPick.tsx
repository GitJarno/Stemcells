/**
 * A plan row's model and effort, picked with the composer's own control (`aski/plan/PlanRow.tsx`;
 * aski-orchestrator.md, decision 18): T3's picker with its docked effort column. A plan's Cell
 * carries its model and one effort, so the column is handed the effort levels and nothing else.
 */
import { isReasoningSelect } from "@t3tools/client-runtime/model-traits";
import type {
  EnvironmentId,
  ProviderDriverKind,
  ProviderInstanceId,
  ServerProvider,
} from "@t3tools/contracts";
import { useMessages } from "gt-react";

import type { TraitsSelectionInput } from "../../components/chat/TraitsPicker";
import { useEnvironmentSettings } from "../../hooks/useSettings";
import { getCustomModelOptionsByInstance } from "../../modelSelection";
import { providerInstanceEntriesFor } from "../../providerInstances";
import { useEnvironmentProviders } from "../../state/environments";
import { isAskisInstance } from "../aski/setup";
import { conciseModelName } from "../models/names";
// Ours, as the composer draws them: a module of our own is handed upstream's (`plugin.ts`).
import { ComposerEffortColumn, describeComposerEffort } from "./substitutes/ComposerModelEffort";
import { ProviderModelPicker } from "./substitutes/ProviderModelPicker";

/** A model as a plan's Cell starts on it. */
export interface PlanModel {
  readonly instanceId: string;
  readonly id: string;
  /** The effort option and level a launch sends; null for the model's own. */
  readonly effort: { readonly option: string; readonly level: string } | null;
}

/** What the person picked: the model by its name too, as the plan's row writes it. */
interface PlanModelPicked extends PlanModel {
  readonly name: string;
}

const NO_PROVIDERS: ReadonlyArray<ServerProvider> = [];

/**
 * The composer's traits for a plan's Cell on `model` of `models`: its effort levels as its only
 * option, read from and written to the plan's one effort. The words are the person's own, sent
 * as they are, so no level is ever written into them.
 */
export function planTraits(input: {
  readonly provider: ProviderDriverKind;
  readonly models: ServerProvider["models"];
  readonly model: PlanModel;
  readonly onEffort: (effort: PlanModel["effort"]) => void;
}): TraitsSelectionInput {
  const { model } = input;
  const levels = new Set<string>();
  const models = input.models.map((each) => {
    const all = each.capabilities?.optionDescriptors;
    if (each.capabilities == null || all === undefined) return each;
    const kept = all.filter(isReasoningSelect);
    if (each.slug === model.id) for (const descriptor of kept) levels.add(descriptor.id);
    return { ...each, capabilities: { ...each.capabilities, optionDescriptors: kept } };
  });
  return {
    provider: input.provider,
    instanceId: model.instanceId as ProviderInstanceId,
    models,
    model: model.id,
    modelOptions:
      model.effort === null ? [] : [{ id: model.effort.option, value: model.effort.level }],
    allowPromptInjectedEffort: false,
    onModelOptionsChange: (options) => {
      const picked = options?.find(
        (option) => levels.has(option.id) && typeof option.value === "string",
      );
      input.onEffort(
        picked === undefined ? null : { option: picked.id, level: String(picked.value) },
      );
    },
  };
}

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
  const { model } = props;
  const instanceId = (model?.instanceId ?? entries[0]?.instanceId ?? "") as ProviderInstanceId;
  const slug = model?.id ?? "";
  const entry = entries.find((each) => each.instanceId === instanceId);
  const nameOf = (instance: string, id: string) =>
    conciseModelName(
      entries.find((each) => each.instanceId === instance)?.models.find((each) => each.slug === id)
        ?.name ?? id,
    );
  const traits =
    entry === undefined || model === null
      ? null
      : planTraits({
          provider: entry.driverKind,
          models: entry.models,
          model,
          onEffort: (effort) =>
            props.onPick({ instanceId, id: slug, name: nameOf(instanceId, slug), effort }),
        });
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
      onInstanceModelChange={(instance, id) =>
        props.onPick({ instanceId: instance, id, name: nameOf(instance, id), effort: null })
      }
    />
  );
}
