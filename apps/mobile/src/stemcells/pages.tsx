import { useNavigation } from "@react-navigation/native";
import { createNativeStackScreen } from "@react-navigation/native-stack";

import { DiskScreen } from "./disk/DiskScreen";
import { allowPushes, usePushState } from "./push/PushCoordinator";
import { SettingsRow } from "./upstream/disk";
import { useSavedRemoteConnections } from "./upstream/push";

// Our settings pages on the phone. Upstream's settings stack spreads these
// screens into its own (`Stack.tsx`), and its index shows these rows at the
// end of Server settings (`SettingsRouteScreen.tsx`): a line in each
// (seams.md).

export const stemcellsSettingsScreens = {
  SettingsDisk: createNativeStackScreen({
    screen: DiskScreen,
    linking: "disk",
    options: { title: "Disk" },
  }),
};

export function StemcellsServerRows() {
  const navigation = useNavigation();
  return (
    <>
      <SettingsRow
        icon="internaldrive"
        label="Disk"
        onPress={() =>
          navigation.navigate("SettingsSheet", {
            screen: "SettingsContent",
            params: { screen: "SettingsDisk" },
          })
        }
      />
      <PushRow />
    </>
  );
}

/** Whether this phone hears from the Macs when a Cell needs the person; a tap allows it. */
function PushRow() {
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
  return (
    <SettingsRow
      icon="bell.badge"
      label="When a Cell needs you"
      value={value}
      onPress={() => void allowPushes(Object.values(savedConnectionsById))}
    />
  );
}
