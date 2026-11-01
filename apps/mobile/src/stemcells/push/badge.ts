import * as Notifications from "expo-notifications";
import { useEffect } from "react";
import { Platform } from "react-native";

/**
 * The app icon's count of Cells at Input while the app runs; `null` leaves it as it is. A closed
 * app's count comes with each Mac's pushes (`apps/server/src/stemcells/push/Push.ts`). iOS shows
 * it only with badges allowed, which the notification prompt asks for.
 */
export function useAppBadge(count: number | null): void {
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Hand the count to iOS, outside React, as it changes.
  useEffect(() => {
    if (count === null || Platform.OS !== "ios") return;
    void Notifications.setBadgeCountAsync(count).catch(() => false);
  }, [count]);
}
