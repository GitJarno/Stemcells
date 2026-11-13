// What a feat's moment takes from upstream on the phone: the overlay a view outside the
// navigator is drawn in, and the way from there to a Settings page.

import { openSettings } from "../../features/settings/settings-navigation";
import { rootNavigationRef } from "../../lib/rootNavigation";

export { Button } from "../../components/ui/Button";
export { OverlayPortal } from "../../components/ui/OverlayPortal";

/** Opens Settings › Collection from outside the navigator, as the Settings list opens a page. */
export function openCollection(): void {
  if (rootNavigationRef.isReady()) openSettings(rootNavigationRef, "SettingsCollection");
}
