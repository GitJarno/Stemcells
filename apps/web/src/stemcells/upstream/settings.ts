/**
 * What Settings on the slate reads from upstream: its section list as upstream's sidebar drew
 * it, the sections' names and scopes, and the way back. `pages.contract.test.ts` pins it. Our
 * own pages (Settings › Aski) use upstream's rows and switch, and a setting Aski shows in its
 * reply reads and writes through upstream's scope, as Settings does.
 */
import {
  ClientSettingsSchema,
  EnvironmentId,
  PROVIDER_DISPLAY_NAMES,
  ProviderInstanceId,
  ServerSettings,
} from "@t3tools/contracts";
import { decodeMsg } from "gt-react";

import type { SchemaAst } from "../../../../../stemcells/settings/controls.ts";
import type { SettingsCatalog } from "../../../../../stemcells/settings/places.ts";
import {
  revealSettingsSearchTarget,
  SETTINGS_SEARCH_ITEMS,
  SETTINGS_SECTION_LABELS,
  type SettingsPath,
  type SettingsSearchItem,
  type SettingsSearchItemId,
} from "../../components/settings/settingsSearch";
import { m } from "../../i18n/messages";
import { NEVER_OFFERED_SETTINGS } from "../pages/settingsPages";
import { SETTINGS_NAV_GROUPS } from "./substitutes/settingsSearch";

export type { ServerSettings } from "@t3tools/contracts";
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
export { updateClientSettings, useClientSettings } from "../../hooks/useSettings";
export { setAppearanceMode, useTheme } from "../../hooks/useTheme";
export {
  Select,
  SelectItem,
  SelectPopup,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
export { Toggle, ToggleGroup } from "../../components/ui/toggle-group";
export { useNavigateToMainApp } from "../../components/sidebar/mainAppLocation";
export type { SettingsPath };
export { revealSettingsSearchTarget };

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

/**
 * Settings as a reply's words name it, in English: its pages, the rows its search finds and the
 * providers its Providers page shows. The shared `stemcells/settings/catalog.json` is this,
 * written out (`settingsCatalog.contract.test.ts`), so the phone reads paths the same way.
 */
export function settingsCatalog(): SettingsCatalog {
  const items: ReadonlyArray<SettingsSearchItem> = SETTINGS_SEARCH_ITEMS;
  return {
    pages: Object.entries(SETTINGS_SECTION_LABELS).map(([path, label]) => ({
      path,
      label: decodeMsg(label),
    })),
    rows: items
      .filter((item) => !NEVER_OFFERED_SETTINGS.has(item.id))
      .map((item) => ({
        id: item.id,
        title: decodeMsg(item.title),
        page: item.to,
        ...(item.targetId === undefined || item.targetId === item.id
          ? {}
          : { anchor: item.targetId }),
      })),
    providers: Object.entries(PROVIDER_DISPLAY_NAMES).map(([driver, label]) => ({
      driver,
      label: label!,
    })),
  };
}

/** The Providers page's search that opens one driver's own card, on a server or the first. */
export function providerCardSearch(driver: string, environmentId: string | undefined) {
  const instanceId = ProviderInstanceId.make(driver);
  return environmentId === undefined
    ? { instanceId }
    : { environmentId: EnvironmentId.make(environmentId), instanceId };
}

const FIELDS = {
  server: ServerSettings.fields,
  client: ClientSettingsSchema.fields,
} as unknown as Readonly<Record<"server" | "client", Readonly<Record<string, { ast: SchemaAst }>>>>;

/** A setting's schema, on the server or this device, as a card reads its control; null if none. */
export function settingAst(store: "server" | "client", key: string): SchemaAst | null {
  return Object.hasOwn(FIELDS[store], key) ? FIELDS[store][key]!.ast : null;
}
