/**
 * Whether this window raises the chats' notifications: the focused window,
 * or the lead while no window of the app has focus (the desktop app picks,
 * `book.ts` `notifier`). Upstream's coordinator then judges by this window's
 * own focus and route: a toast here unless this window shows the chat, a
 * system notification only while the app is in the background. A browser's
 * one window always notifies.
 */
import { useSyncExternalStore } from "react";

import { windowsBridge } from "./bridge";

const bridge = windowsBridge();
let notifies = bridge ? bridge.boot.notifies : true;
const listeners = new Set<() => void>();

bridge?.onNotifies((value) => {
  notifies = value;
  for (const listener of listeners) listener();
});

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => void listeners.delete(listener);
};

export function notifiesHere(): boolean {
  return notifies;
}

export function useNotifiesHere(): boolean {
  return useSyncExternalStore(subscribe, notifiesHere, notifiesHere);
}
