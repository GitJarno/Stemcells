import * as Effect from "effect/Effect";
import * as Option from "effect/Option";

// Stemcells keeps no analytics id for this browser or app. Upstream's client
// kept one in site storage and sent its hash to every server it connected
// to, which a T3 server forwards to T3's analytics. Asking for it here
// removes one an earlier build left, and answers that there is none.

export const UPSTREAM_ANALYTICS_DEVICE_ID_KEY = "t3code:analytics-device-id";

export const noAnalyticsDevice = {
  id: Effect.sync(() => {
    try {
      window.localStorage.removeItem(UPSTREAM_ANALYTICS_DEVICE_ID_KEY);
    } catch {
      // Storage is blocked, so there is nothing kept to remove.
    }
    return Option.none<string>();
  }),
};
