import * as Effect from "effect/Effect";
import * as Option from "effect/Option";

// Stemcells keeps no analytics id for this phone. Upstream's app makes a random one, keeps it
// in secure storage and sends its hash to every server it connects to, which a T3 server
// forwards to T3's analytics. Answering that there is none means none is ever made.

export const noAnalyticsDevice = { id: Effect.succeed(Option.none<string>()) };
