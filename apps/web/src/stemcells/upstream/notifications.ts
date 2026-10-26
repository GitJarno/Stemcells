/**
 * With more than one window, one notifies of a chat's turns: the focused one, or the lead while
 * the app is in the background (`windows/notifier.ts`); a browser's one window always does.
 * Upstream's notifications run for the page's life, so here they run only while this window is
 * the one, and stop, badge and all, when another takes over.
 */
import { startThreadNotifications as startUpstream } from "../../components/ThreadNotificationCoordinator";
import { notifiesHere, onNotifiesChange } from "../windows/notifier";

export const startOneWindowNotifications: typeof startUpstream = (registry, router) => {
  let stop = notifiesHere() ? startUpstream(registry, router) : null;
  const unsubscribe = onNotifiesChange(() => {
    if (notifiesHere() && stop === null) stop = startUpstream(registry, router);
    if (!notifiesHere() && stop !== null) {
      stop();
      stop = null;
    }
  });
  return () => {
    unsubscribe();
    stop?.();
  };
};
