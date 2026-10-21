/**
 * What Settings on the slate reads from upstream: its section list as
 * upstream's sidebar drew it, the sections' names and which of them a scope
 * shows, and the way back to where you were. `pages.contract.test.ts` pins
 * what the slate relies on.
 */
import { useLocation } from "@tanstack/react-router";

import {
  isSettingsOverviewVisible,
  SETTINGS_SECTION_LABELS,
  type SettingsPath,
} from "../../components/settings/settingsSearch";
import { validateSettingsScopeSearch } from "../../components/settings/settingsScope";

export { SettingsSidebarNav } from "../../components/settings/SettingsSidebarNav";
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
