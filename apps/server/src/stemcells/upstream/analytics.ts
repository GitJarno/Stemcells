import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import * as ServerConfig from "../../config.ts";
import { AnalyticsService } from "../../telemetry/AnalyticsService.ts";

// What Stemcells' privacy takes from upstream: the analytics service every
// server feature records through, and the file upstream's telemetry keeps
// its install id in.

/**
 * Upstream's analytics service, recording nothing. It needs no service, so
 * it can't reach the network or the disk: no event is built, buffered,
 * written or sent, and no telemetry id is made or read.
 */
export const noAnalytics: Layer.Layer<AnalyticsService> = Layer.succeed(
  AnalyticsService,
  AnalyticsService.of({
    record: () => Effect.void,
    flush: Effect.void,
    recordOwners: () => Effect.void,
  }),
);

/** Where upstream's telemetry wrote this install's id, under the state folder. */
export const telemetryIdPath = Effect.gen(function* () {
  const { anonymousIdPath } = yield* ServerConfig.ServerConfig;
  return anonymousIdPath;
});
