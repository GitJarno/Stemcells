/**
 * Upstream's chat notifications, raised by one window: every window's page
 * mounts the coordinator, and with several windows each would notify of the
 * same turn. The window that raises them is the focused one, or the lead
 * while the app is in the background (`windows/notifier.ts`); a browser's
 * one window always does.
 */
import { ThreadNotificationCoordinator } from "../../components/ThreadNotificationCoordinator";
import { useNotifiesHere } from "../windows/notifier";

export function OneWindowNotifications() {
  return useNotifiesHere() ? <ThreadNotificationCoordinator /> : null;
}
