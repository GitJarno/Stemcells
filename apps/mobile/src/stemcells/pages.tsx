import { useNavigation } from "@react-navigation/native";
import { createNativeStackScreen } from "@react-navigation/native-stack";
import type { ComponentProps } from "react";

import { DiskScreen } from "./disk/DiskScreen";
import { allowPushes, usePushState } from "./push/PushCoordinator";
import { openSettings, type SettingsRow } from "./upstream/disk";
import { useSavedRemoteConnections } from "./upstream/push";

// Our settings pages on the phone. Upstream's Settings pages are root
// routes: its list of them spreads these, with its own page options
// (`Stack.tsx`), and its index lists these rows at the end of Server
// settings, where its search finds them (`SettingsRouteScreen.tsx`): a line
// in each (seams.md).

export const stemcellsSettingsScreens = <Options extends object>(pageOptions: Options) => ({
  SettingsDisk: createNativeStackScreen({
    screen: DiskScreen,
    linking: "settings/disk",
    options: { ...pageOptions, title: "Disk" },
  }),
});

type Row = ComponentProps<typeof SettingsRow> & { readonly id: string };

export function useStemcellsServerRows(): Row[] {
  const navigation = useNavigation();
  const push = usePushRow();
  const disk: Row = {
    id: "SettingsDisk",
    icon: "internaldrive",
    label: "Disk",
    onPress: () => openSettings(navigation, "SettingsDisk"),
  };
  return push ? [disk, push] : [disk];
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
