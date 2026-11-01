/**
 * Substitutes upstream's `components/settings/UpdateTrackSwitchDialog.tsx`
 * (`plugin.ts`). Upstream's dialog moves this app and every server to T3's
 * npm release on the picked track, and asks npm which release that is.
 * Stemcells updates only from its own source, which builds both tracks, so
 * picking one sets it through the desktop bridge, as the select did before,
 * and nothing asks npm about T3's release (`seams.md`, No T3 build offered).
 */
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
  return null;
}
