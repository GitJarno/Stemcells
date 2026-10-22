import { useNavigation } from "@react-navigation/native";
import { createNativeStackScreen } from "@react-navigation/native-stack";

import { DiskScreen } from "./disk/DiskScreen";
import { SettingsRow } from "./upstream/disk";

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
  );
}
