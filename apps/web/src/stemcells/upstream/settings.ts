/**
 * What Settings on the slate reads from upstream: its section list as upstream's sidebar drew
 * it, the sections' names and scopes, and the way back. `pages.contract.test.ts` pins it. Our
 * own pages (Settings › Aski) use upstream's rows and switch, and a setting Aski shows in its
 * reply reads and writes through upstream's scope, as Settings does.
 */
import {
  SETTINGS_SEARCH_ITEMS,
  SETTINGS_SECTION_LABELS,
  type SettingsPath,
  type SettingsSearchItemId,
} from "../../components/settings/settingsSearch";
import { m } from "../../i18n/messages";
import { SETTINGS_NAV_GROUPS } from "./substitutes/settingsSearch";

export { SettingsSidebarNav } from "../../components/settings/SettingsSidebarNav";
export {
  SettingsPageContainer,
  SettingsRow,
  SettingsSection,
} from "../../components/settings/settingsLayout";
export { useNowMinuteMs } from "./needs";
export { Switch } from "../../components/ui/switch";
export { ScopedSwitch } from "../../components/settings/ScopedSwitch";
export { SettingsScopeProvider } from "../../components/settings/SettingsScopeContext";
export {
  useScopedSettings,
  useUpdateScopedSettings,
} from "../../components/settings/useScopedSettings";
export { Toggle, ToggleGroup } from "../../components/ui/toggle-group";
export { useNavigateToMainApp } from "../../components/sidebar/mainAppLocation";
export type { SettingsPath };

/** The sections upstream's sidebar lists, in its order, with ours where the substitute places them. */
export const SETTINGS_SECTIONS: ReadonlyArray<{ to: SettingsPath; label: string }> =
  SETTINGS_NAV_GROUPS.flatMap((group) => group.paths).map((to) => ({
    to,
    label: SETTINGS_SECTION_LABELS[to],
  }));

/** A setting's search anchor and title, as upstream's own rows get them (`useSearchableSetting`). */
export function searchableSetting(id: SettingsSearchItemId): {
  readonly id: string;
  readonly title: string;
} {
  const item = SETTINGS_SEARCH_ITEMS.find((entry) => entry.id === id)!;
  return { id: item.id, title: m(item.title) };
}
