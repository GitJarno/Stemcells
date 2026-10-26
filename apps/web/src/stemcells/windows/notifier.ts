/**
 * Whether this window raises the chats' notifications: the focused window, or the lead while
 * no window has focus (`book.ts` `notifier`). Upstream's coordinator then judges by this
 * window's focus and route: a toast unless this window shows the chat, a system notification
 * only in the background. A browser's one window always notifies.
 */
import { windowsBridge } from "./bridge";

const bridge = windowsBridge();
let notifies = bridge ? bridge.boot.notifies : true;
const listeners = new Set<() => void>();

bridge?.onNotifies((value) => {
  notifies = value;
  for (const listener of listeners) listener();
});

/** Calls `listener` whenever another window takes the notifying over, or this one does. */
export const onNotifiesChange = (listener: () => void) => {
  listeners.add(listener);
  return () => void listeners.delete(listener);
};

export function notifiesHere(): boolean {
  return notifies;
}
