// Replaces `components/ThreadNotificationCoordinator.tsx` (`plugin.ts`): with
// more than one window, one window notifies of a chat's turns: the focused
// one, or the lead while the app is in the background.
export * from "../../../components/ThreadNotificationCoordinator";
export { startOneWindowNotifications as startThreadNotifications } from "../notifications";
