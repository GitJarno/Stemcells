import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";

import * as UpstreamAnalytics from "../upstream/analytics.ts";

// Stemcells sends no telemetry or usage data, to T3 or anyone else. The
// server records through a service that keeps nothing, and on start removes
// the install id upstream's telemetry left in the state folder before this
// fork turned it off.

/** The analytics service the server runs: records nothing. */
export const analytics = UpstreamAnalytics.noAnalytics;

export const forgetTelemetryId = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* UpstreamAnalytics.telemetryIdPath;
  if (!(yield* fs.exists(path))) return;
  yield* fs.remove(path);
  yield* Effect.logInfo("Stemcells: removed upstream's telemetry id", { path });
});

/** The server starts either way; a file left behind is never read. */
export const layer = Layer.effectDiscard(
  forgetTelemetryId.pipe(
    Effect.catchCause((cause) =>
      Effect.logWarning("Stemcells: telemetry id not removed", { cause }),
    ),
  ),
);
