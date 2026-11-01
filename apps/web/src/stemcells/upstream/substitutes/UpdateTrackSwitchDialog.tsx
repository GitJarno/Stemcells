// Substitutes upstream's `settings/UpdateTrackSwitchDialog.tsx` (`plugin.ts`), which moves every
// machine to T3's npm release on the picked track. Stemcells updates from its own source, so a
// pick only saves the track, and nothing asks npm about T3's release (seams.md, No T3 build).
import { useEffect, useRef, type ComponentProps } from "react";

import type * as Upstream from "../../../components/settings/UpdateTrackSwitchDialog";
import { stackedThreadToast, toastManager } from "../../../components/ui/toast";
import { useDesktopUpdateState } from "../../../state/desktopUpdate";

export function UpdateTrackSwitchDialog({
  channel,
  onClose,
}: ComponentProps<typeof Upstream.UpdateTrackSwitchDialog>) {
  const current = useDesktopUpdateState()?.channel ?? "latest";
  // Settings hands a new `onClose` each render; the pick is saved once.
  const saved = useRef(false);
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Settings opens this for a picked track; the pick is saved through the desktop bridge, outside React.
  useEffect(() => {
    if (saved.current) return;
    saved.current = true;
    const bridge = window.desktopBridge;
    if (!bridge || channel === current) {
      onClose();
      return;
    }
    void bridge
      .setUpdateChannel(channel)
      .catch((error: unknown) => {
        toastManager.add(
          stackedThreadToast({
            type: "error",
            title: "Could not change update track",
            description: error instanceof Error ? error.message : "Update track change failed.",
          }),
        );
      })
      .finally(onClose);
  }, [channel, current, onClose]);
  // Upstream's renders a dialog; this one has nothing to ask.
  return <span hidden />;
}
