// Replaces `components/settings/settingsSearch.ts` (`plugin.ts`): Stemcells'
// composer never rests into one line (`composerScrollGesture.ts`), so
// upstream's "Collapse composer on scroll" setting has nothing to turn on.
// Settings search never offers it, and its row is hidden
// (`settingsSearch.css`). The setting itself stays in upstream's settings.
import * as Upstream from "../../../components/settings/settingsSearch";
import "./settingsSearch.css";

export * from "../../../components/settings/settingsSearch";

export function searchSettings(
  ...args: Parameters<typeof Upstream.searchSettings>
): ReturnType<typeof Upstream.searchSettings> {
  return Upstream.searchSettings(...args).filter((item) => item.id !== "composer-collapse");
}
