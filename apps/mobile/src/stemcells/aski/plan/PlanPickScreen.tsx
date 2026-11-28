// The model and effort of a plan's Cell, picked before it is sent
// (stemcells/tasks/aski-orchestrator.md, decision 18): the sheet the composer's model control
// opens, the same screen, reading and writing the plan's tray. A Cell starts with its
// project's own access, so Access is left out.

import { type StaticScreenProps, useNavigation } from "@react-navigation/native";
import { useEffect } from "react";
import { View } from "react-native";

import { setModel } from "../../../../../../stemcells/orchestrator/tray.ts";
import { PickOffersAccess } from "../../models/pickScope";
import {
  type ModelSelection,
  type ProviderOptionSelection,
  ThreadSettingsPickerScreen,
  usePickCatalog,
} from "../../upstream/planPick";
import { useNewCellDefaults } from "../../upstream/plans";
import { selectionOf } from "./launch";
import { fieldOf, projectIdOf } from "./pick";
import { trays } from "./run";
import { usePlans } from "./usePlans";
import { usePlanWorld } from "./usePlanWorld";

export function PlanPickScreen({
  route,
}: StaticScreenProps<{ readonly planId: string; readonly i: number }>) {
  const { planId, i } = route.params;
  const navigation = useNavigation();
  const entry = usePlans().get(planId);
  const one = entry?.tray?.acts.find((each) => each.act.i === i);
  const act = one?.act.kind === "start" && one.status === "waiting" ? one.act : null;
  const environmentId = entry?.environmentId ?? "";
  const { models } = usePlanWorld(environmentId);
  const projectId = act === null ? null : projectIdOf(act);
  const defaults = useNewCellDefaults(environmentId, projectId);
  const selection =
    act === null ? null : selectionOf(act, { defaultModel: defaults.model, models });
  const effort = models.find(
    (model) => model.instanceId === selection?.instanceId && model.id === selection.model,
  )?.effortOption;
  const catalog = usePickCatalog(environmentId, projectId, selection, effort);
  const gone = act === null;
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- The Cell was sent or dropped from another view while the sheet stood open: the sheet closes.
  useEffect(() => {
    if (gone) navigation.goBack();
  }, [gone, navigation]);
  if (act === null) return <View className="flex-1 bg-sheet" />;
  const choose = (next: ModelSelection) =>
    trays.change(planId, (tray) => setModel(tray, i, fieldOf(next, models)));
  return (
    <PickOffersAccess value={false}>
      <ThreadSettingsPickerScreen
        environmentId={catalog.environmentId}
        projectId={catalog.projectId}
        cwd={null}
        {...(selection === null ? {} : { providerInstanceId: selection.instanceId })}
        providerGroups={catalog.providerGroups}
        selectedModel={selection}
        prompt=""
        onPromptChange={() => undefined}
        onSelectModel={(option) => choose(option.selection)}
        optionDescriptors={catalog.optionDescriptors}
        onUpdateOptionSelections={(options: ReadonlyArray<ProviderOptionSelection>) => {
          if (selection !== null) choose({ ...selection, options });
        }}
        runtimeMode={defaults.runtimeMode}
        onUpdateRuntimeMode={() => undefined}
        onClose={() => navigation.goBack()}
      />
    </PickOffersAccess>
  );
}
