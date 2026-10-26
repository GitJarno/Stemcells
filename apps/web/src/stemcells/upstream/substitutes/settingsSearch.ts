// Replaces `components/settings/settingsSearch.ts` (`plugin.ts`). Two upstream rows keep their
// place in its panels but are never offered, and search, the palette's too, skips both:
// "Collapse composer on scroll" has nothing to turn on (`settingsSearch.css` hides it), and
// "Privacy policy" accounts for usage data Stemcells never sends (`seams.md`, No telemetry).
import * as Upstream from "../../../components/settings/settingsSearch";
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
