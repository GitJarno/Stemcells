// The zoom level, in upstream's toasts where every notice shows (top right).
// One toast, by its id: upstream's toast manager updates a toast added again
// under the same id in place and starts its timeout over, so keys held down
// never stack toasts, and it fades a linger after the last change.
import { toastManager } from "../../components/ui/toast";
import { timing } from "../tokens/motion";

const ZOOM_TOAST_ID = "stemcells-zoom-level";

export function showZoomLevel(percent: number): void {
  toastManager.add({
    id: ZOOM_TOAST_ID,
    // The mark lets `zoom/zoom.css` find this toast, for Reduce Motion.
    title: <span data-stemcells-zoom-level="">{percent}%</span>,
    timeout: timing("linger"),
  });
}
