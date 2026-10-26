/**
 * What Settings on the slate reads from upstream: its section list as upstream's sidebar drew
 * it, the sections' names and scopes, and the way back. `pages.contract.test.ts` pins it. Our
 * own pages (Settings › Aski) use upstream's rows and switch, and a setting Aski shows in its
 * reply reads and writes through upstream's scope, as Settings does.
 */
import { useLocation } from "@tanstack/react-router";

import {
  isSettingsOverviewVisible,
  SETTINGS_SECTION_LABELS,
  type SettingsPath,
} from "../../components/settings/settingsSearch";
import { validateSettingsScopeSearch } from "../../components/settings/settingsScope";

export { SettingsSidebarNav } from "../../components/settings/SettingsSidebarNav";
export {
  SettingsPageContainer,
  SettingsRow,
  SettingsSection,
} from "../../components/settings/settingsLayout";
export { useNowSecond } from "../../hooks/useNowSecond";
export { useNowMinuteMs } from "./needs";
export { Switch } from "../../components/ui/switch";
export { ScopedSwitch } from "../../components/settings/ScopedSwitch";
export { SettingsScopeProvider } from "../../components/settings/SettingsScopeContext";
export { searchableSetting } from "../../components/settings/settingsSearch";
export {
  useScopedSettings,
  useUpdateScopedSettings,
} from "../../components/settings/useScopedSettings";
export { Toggle, ToggleGroup } from "../../components/ui/toggle-group";
export { useNavigateToMainApp } from "../../components/sidebar/mainAppLocation";
export type { SettingsPath };

/**
 * The sections upstream's list shows for the scope in the address, in its
 * order, by name: Diagnostics is reached from General, and Project only for
 * a project or a checkout.
 */
export function useSettingsSections(): ReadonlyArray<{ to: SettingsPath; label: string }> {
  const search = useLocation({ select: (location) => location.search });
  const overview = isSettingsOverviewVisible(validateSettingsScopeSearch(search));
  return (Object.keys(SETTINGS_SECTION_LABELS) as SettingsPath[])
    .filter((to) => to !== "/settings/diagnostics")
    .filter((to) => to !== "/settings/projects" || overview)
    .map((to) => ({ to, label: SETTINGS_SECTION_LABELS[to] }));
}
