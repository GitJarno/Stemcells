import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";

import * as ServerConfig from "../../config.ts";
import * as DirectEndpoints from "../../environment/DirectEndpoints.ts";
import { onMarkPath } from "./tailscale.ts";

// Upstream names this computer's Tailscale address to clients only behind its own Tailscale
// switch, which relaunches the app. Phones over Tailscale are ours (`tailscale/StemcellsTailscale.ts`):
// while they're on, every client is told the address too, and saves it as one more way here.

/** Upstream's `make`, told the Tailscale address whenever the person's mark is on. */
export const directEndpoints = (make: typeof DirectEndpoints.make) =>
  Layer.effect(
    DirectEndpoints.DirectEndpoints,
    Effect.gen(function* () {
      const config = yield* ServerConfig.ServerConfig;
      const asConfigured = yield* make;
      if (config.tailscaleServeEnabled) return asConfigured;
      const withServe = yield* make.pipe(
        Effect.provideService(ServerConfig.ServerConfig, {
          ...config,
          tailscaleServeEnabled: true,
        }),
      );
      const fs = yield* FileSystem.FileSystem;
      const mark = yield* onMarkPath;
      // Off, Tailscale isn't asked at all: the Mac App Store's can prompt for access when run.
      const on = fs.exists(mark).pipe(Effect.orElseSucceed(() => false));
      return DirectEndpoints.DirectEndpoints.of({
        resolve: Effect.fn("StemcellsDirectEndpoints.resolve")(function* () {
          return yield* ((yield* on) ? withServe : asConfigured).resolve();
        }),
      });
    }),
  );
