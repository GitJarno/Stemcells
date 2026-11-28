import { useNavigation } from "@react-navigation/native";
import { createNativeStackScreen } from "@react-navigation/native-stack";
import type { ComponentProps } from "react";

import { COLLECTION } from "../../../../stemcells/words/feats.ts";
import { AskiButton } from "./aski/AskiButton";
import { PLAN_PICK } from "./aski/plan/pick";
import { PlanPickScreen } from "./aski/plan/PlanPickScreen";
import { railFocusFrom } from "./aski/rail";
import { useScreenFocused } from "./aski/railFocus";
import { CollectionScreen } from "./collection/CollectionScreen";
import { COLLECTION_ICON, RailTrophy } from "./collection/trophy";
import { DiskScreen } from "./disk/DiskScreen";
import { PlanSheet } from "./limits/PlanSheet";
import { pickSheet } from "./models/pickSheet";
import { QuietWorkOnce } from "./work/QuietWork";
import { allowPushes, usePushState } from "./push/PushCoordinator";
import { openSettings, type SettingsRow } from "./upstream/disk";
import { sheetRoute } from "./upstream/planPick";
import { useSavedRemoteConnections } from "./upstream/push";

// Our pages on the phone. Upstream's Settings routes spread these with its own page options
// (`Stack.tsx`), and its index lists these rows at the end of Server settings, where its search
// finds them (`SettingsRouteScreen.tsx`): a line in each (seams.md). The sheet a plan's Cell
// picks its model in rides along: the root stack takes every route spread there.

export const stemcellsSettingsScreens = <Options extends object>(
  settingsPage: (title: string) => Options,
) => ({
  SettingsCollection: createNativeStackScreen({
    screen: CollectionScreen,
    linking: "settings/collection",
    options: settingsPage(COLLECTION.title),
  }),
  SettingsDisk: createNativeStackScreen({
    screen: DiskScreen,
    linking: "settings/disk",
    options: settingsPage("Disk"),
  }),
  [PLAN_PICK]: createNativeStackScreen({
    screen: PlanPickScreen,
    // The sheet the composer's model control opens (`Stack.tsx`, `THREAD_SETTINGS_ROUTE`).
    options: pickSheet(
      sheetRoute({ detent: "full", header: "none", android: "card", spansRail: true }),
    ),
  }),
});

railFocusFrom(useScreenFocused);

type Row = ComponentProps<typeof SettingsRow> & { readonly id: string };

export function useStemcellsServerRows(): Row[] {
  const navigation = useNavigation();
  const push = usePushRow();
  const collection: Row = {
    id: "SettingsCollection",
    icon: COLLECTION_ICON,
    label: COLLECTION.title,
    onPress: () => openSettings(navigation, "SettingsCollection"),
  };
  const disk: Row = {
    id: "SettingsDisk",
    icon: "internaldrive",
    label: "Disk",
    onPress: () => openSettings(navigation, "SettingsDisk"),
  };
  return push ? [collection, disk, push] : [collection, disk];
}

/** Whether this phone hears from the Macs when a Cell needs the person; a tap allows it. */
function usePushRow(): Row | null {
  const push = usePushState();
  const { savedConnectionsById } = useSavedRemoteConnections();
  if (push.permission === "unsupported") return null;
  const reached = [...push.macs.values()].filter((answer) => answer === "registered").length;
  const value =
    push.permission === "denied"
      ? "Off in iOS Settings"
      : push.permission !== "granted"
        ? "Off"
        : reached === 0
          ? "No Mac answered"
          : reached === 1
            ? "On for 1 Mac"
            : `On for ${reached} Macs`;
  return {
    id: "StemcellsPush",
    icon: "bell.badge",
    label: "When a Cell needs you",
    value,
    onPress: () => void allowPushes(Object.values(savedConnectionsById)),
  };
}

/**
 * What stands over the workspace beside its pages, mounted once (`Stack.tsx`): Aski's button, the
 * trophy in the Duo's rail on Usage, the plans' sheet the rings open, and the chat's quieter work
 * log set once.
 */
export function OverWorkspace(props: ComponentProps<typeof AskiButton>) {
  return (
    <>
      <AskiButton {...props} />
      <RailTrophy />
      <PlanSheet />
      <QuietWorkOnce />
    </>
  );
}
