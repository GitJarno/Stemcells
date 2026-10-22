// Replaces `components/settings/settingsSearch.ts` (`plugin.ts`). Two of
// upstream's settings rows are never offered in Stemcells; each keeps its
// place in upstream's code, so the panels that draw them stay upstream's:
//
// - "Collapse composer on scroll": Stemcells' composer never rests into one
//   line (`composerScrollGesture.ts`), so the setting has nothing to turn
//   on. Its row is hidden by its anchor id (`settingsSearch.css`). The
//   setting itself stays in upstream's settings.
// - "Privacy policy": it links T3's policy as the account of "the anonymous
//   usage data T3 Code collects", and Stemcells sends none (`seams.md`, No
//   telemetry). Its row is given `hidden`, so it is neither shown nor
//   reached by the keyboard, and it links out only; what keeps the person's
//   data at home is the server's no-op analytics, which
//   `analytics.contract.test.ts` holds in place.
//
// Settings search, and the command palette's, skip both.
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
