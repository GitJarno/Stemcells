/**
 * Whether this window leads: the one window where the app's one-per-app
 * work runs (setting up Aski's chat, seating Aski's tab when no window holds
 * it). A browser's one window always leads.
 */
import { useSyncExternalStore } from "react";

import { windowsBridge } from "./bridge";

const bridge = windowsBridge();
let lead = bridge ? bridge.boot.lead : true;
const listeners = new Set<() => void>();

bridge?.onLead((value) => {
  lead = value;
  for (const listener of listeners) listener();
});

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => void listeners.delete(listener);
};

export function isLeadWindow(): boolean {
  return lead;
}

export function useLeadWindow(): boolean {
  return useSyncExternalStore(subscribe, isLeadWindow, isLeadWindow);
}
