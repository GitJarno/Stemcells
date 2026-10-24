import * as Effect from "effect/Effect";
import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { useEffect, useSyncExternalStore } from "react";
import { AppState, Linking, Platform } from "react-native";

import {
  isRelayManagedConnection,
  requestAgentNotificationPermission,
  resolveApsEnvironment,
  supportsAgentAwarenessPush,
  useSavedRemoteConnections,
  type SavedRemoteConnection,
} from "../upstream/push";
import { registerWith, type PhoneDevice, type Registered } from "./register";

// The phone asks each saved Mac for pushes whenever it comes to the front
// with notifications allowed (stemcells/tasks/phone-push.md): iOS's own
// switch for the app is the person's way out. Android has no sender of
// ours (it would need Google's), so it never asks.

export interface PushState {
  readonly permission: "granted" | "denied" | "undetermined" | "unsupported";
  /** Each saved Mac's answer, by environment id. */
  readonly macs: ReadonlyMap<string, Registered>;
}

let state: PushState = { permission: "undetermined", macs: new Map() };
const listeners = new Set<() => void>();

function publish(next: PushState) {
  state = next;
  for (const listener of listeners) listener();
}

async function phoneDevice(): Promise<PhoneDevice | null> {
  const topic = Constants.expoConfig?.ios?.bundleIdentifier?.trim();
  const token = await Notifications.getDevicePushTokenAsync().catch(() => null);
  if (!topic || token?.type !== "ios" || typeof token.data !== "string") return null;
  const data = token.data.trim();
  if (data === "") return null;
  return {
    token: data,
    environment:
      resolveApsEnvironment(Constants.expoConfig?.extra?.appVariant) === "sandbox"
        ? "development"
        : "production",
    topic,
    label: Constants.deviceName?.trim() || "iPhone",
  };
}

async function registerAll(connections: ReadonlyArray<SavedRemoteConnection>): Promise<void> {
  if (Platform.OS !== "ios" || !supportsAgentAwarenessPush()) {
    return publish({ permission: "unsupported", macs: new Map() });
  }
  const permissions = await Notifications.getPermissionsAsync().catch(() => null);
  if (!permissions?.granted) {
    const permission = permissions?.canAskAgain === false ? "denied" : "undetermined";
    return publish({ permission, macs: new Map() });
  }
  const device = await phoneDevice();
  if (device === null) return publish({ permission: "granted", macs: new Map() });
  // Every Mac, every time: one that forgot the phone (Apple called its token
  // gone, or the person removed it) hears of it again, and one that knows it
  // changes nothing.
  const macs = new Map<string, Registered>();
  await Promise.all(
    connections
      // A relay's connection belongs to T3's cloud, which Stemcells never uses.
      .filter((connection) => !isRelayManagedConnection(connection))
      .map(async (connection) => {
        macs.set(connection.environmentId, await registerWith(connection, device));
      }),
  );
  publish({ permission: "granted", macs });
}

let queue = Promise.resolve();
/** One registration at a time, in the order asked. */
const refresh = (connections: ReadonlyArray<SavedRemoteConnection>) => {
  queue = queue.then(() => registerAll(connections));
  return queue;
};

/** Asks iOS for notifications, or opens the app's iOS settings once it won't ask again; then asks the Macs. */
export async function allowPushes(connections: ReadonlyArray<SavedRemoteConnection>) {
  const asked = await Effect.runPromise(requestAgentNotificationPermission).catch(() => null);
  if (asked?.type === "denied" && !asked.canAskAgain) await Linking.openSettings();
  await refresh(connections);
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const read = () => state;

export function usePushState(): PushState {
  return useSyncExternalStore(subscribe, read, read);
}

/** Mounted once for the app: asks the Macs on start, when the saved ones change, and on each return to the front. */
export function PushCoordinator() {
  const { savedConnectionsById } = useSavedRemoteConnections();
  useEffect(() => {
    const connections = Object.values(savedConnectionsById);
    void refresh(connections);
    const subscription = AppState.addEventListener("change", (next) => {
      if (next === "active") void refresh(connections);
    });
    return () => subscription.remove();
  }, [savedConnectionsById]);
  return null;
}
