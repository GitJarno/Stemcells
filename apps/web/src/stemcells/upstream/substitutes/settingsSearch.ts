// Replaces `components/settings/settingsSearch.ts` (`plugin.ts`). Search, the palette's too,
// never offers "Privacy policy" (usage data Stemcells never sends; `seams.md`, No telemetry),
// and its row is drawn hidden. Our own pages stand in its sidebar's groups, each where
// `settingsPages.ts` places it.
import * as Upstream from "../../../components/settings/settingsSearch";
import { NEVER_OFFERED_SETTINGS, STEMCELLS_SETTINGS_NAV_AFTER } from "../../pages/settingsPages";

export * from "../../../components/settings/settingsSearch";

export function useSearchableSetting(): ReturnType<typeof Upstream.useSearchableSetting> {
  const searchable = Upstream.useSearchableSetting();
  return (id) => {
    const props = searchable(id);
    if (!NEVER_OFFERED_SETTINGS.has(id)) return props;
    const hidden: typeof props & { readonly hidden: true } = { ...props, hidden: true };
    return hidden;
  };
}

export function searchSettings(
  ...args: Parameters<typeof Upstream.searchSettings>
): ReturnType<typeof Upstream.searchSettings> {
  return Upstream.searchSettings(...args).filter((item) => !NEVER_OFFERED_SETTINGS.has(item.id));
}

export function filterAvailableSettingsSearchItems(
  ...args: Parameters<typeof Upstream.filterAvailableSettingsSearchItems>
): ReturnType<typeof Upstream.filterAvailableSettingsSearchItems> {
  return Upstream.filterAvailableSettingsSearchItems(...args).filter(
    (item) => !NEVER_OFFERED_SETTINGS.has(item.id),
  );
}

function withOurPages(
  upstream: ReturnType<typeof Upstream.settingsNavGroups>,
): ReturnType<typeof Upstream.settingsNavGroups> {
  const groups = upstream.map((group) => ({ ...group, paths: [...group.paths] }));
  for (const [path, after] of Object.entries(STEMCELLS_SETTINGS_NAV_AFTER) as Array<
    [keyof typeof STEMCELLS_SETTINGS_NAV_AFTER, string]
  >) {
    const group = groups.find((each) => each.paths.some((page) => page === after)) ?? groups.at(-1);
    if (group === undefined) continue;
    const index = group.paths.findIndex((page) => page === after);
    group.paths.splice(index === -1 ? group.paths.length : index + 1, 0, path);
  }
  return groups;
}

// Upstream hands out one list per answer, so ours keep one each too.
const WITH_SECRETS = withOurPages(Upstream.settingsNavGroups(true));
const WITHOUT_SECRETS = withOurPages(Upstream.settingsNavGroups(false));

export function settingsNavGroups(
  hasSecretProvidersEnvironment: boolean,
): ReturnType<typeof Upstream.settingsNavGroups> {
  return hasSecretProvidersEnvironment ? WITH_SECRETS : WITHOUT_SECRETS;
}
