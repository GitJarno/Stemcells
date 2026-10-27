// Replaces `components/settings/settingsSearch.ts` (`plugin.ts`). Two upstream rows keep their
// place in its panels but are never offered, and search, the palette's too, skips both:
// "Collapse composer on scroll" has nothing to turn on (`settingsSearch.css` hides it), and
// "Privacy policy" accounts for usage data Stemcells never sends (`seams.md`, No telemetry).
// Our own pages stand in its sidebar's groups, each where `settingsPages.ts` places it.
import * as Upstream from "../../../components/settings/settingsSearch";
import { STEMCELLS_SETTINGS_NAV_AFTER } from "../../pages/settingsPages";
import "./settingsSearch.css";

export * from "../../../components/settings/settingsSearch";

/** Upstream's rows Stemcells never offers, by their search id. */
const NEVER_OFFERED: ReadonlySet<string> = new Set(["composer-collapse", "privacy-policy"]);

/** Of those, the rows hidden here, through the props upstream's row spreads on its root. */
const HIDDEN_ROWS: ReadonlySet<string> = new Set(["privacy-policy"]);

export function searchableSetting(
  ...args: Parameters<typeof Upstream.searchableSetting>
): ReturnType<typeof Upstream.searchableSetting> {
  const props = Upstream.searchableSetting(...args);
  if (!HIDDEN_ROWS.has(args[0])) return props;
  const hidden: ReturnType<typeof Upstream.searchableSetting> & { readonly hidden: true } = {
    ...props,
    hidden: true,
  };
  return hidden;
}

export function searchSettings(
  ...args: Parameters<typeof Upstream.searchSettings>
): ReturnType<typeof Upstream.searchSettings> {
  return Upstream.searchSettings(...args).filter((item) => !NEVER_OFFERED.has(item.id));
}

export function filterAvailableSettingsSearchItems(
  ...args: Parameters<typeof Upstream.filterAvailableSettingsSearchItems>
): ReturnType<typeof Upstream.filterAvailableSettingsSearchItems> {
  return Upstream.filterAvailableSettingsSearchItems(...args).filter(
    (item) => !NEVER_OFFERED.has(item.id),
  );
}

export const SETTINGS_NAV_GROUPS: typeof Upstream.SETTINGS_NAV_GROUPS = (() => {
  const groups = Upstream.SETTINGS_NAV_GROUPS.map((group) => ({
    ...group,
    paths: [...group.paths],
  }));
  for (const [path, after] of Object.entries(STEMCELLS_SETTINGS_NAV_AFTER) as Array<
    [keyof typeof STEMCELLS_SETTINGS_NAV_AFTER, string]
  >) {
    const group = groups.find((each) => each.paths.some((page) => page === after)) ?? groups.at(-1);
    if (group === undefined) continue;
    const index = group.paths.findIndex((page) => page === after);
    group.paths.splice(index === -1 ? group.paths.length : index + 1, 0, path);
  }
  return groups;
})();
