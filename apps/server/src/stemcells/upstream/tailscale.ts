import * as Effect from "effect/Effect";
import * as Path from "effect/Path";
import { HttpServer } from "effect/http";

import * as ServerConfig from "../../config.ts";
import { loopbackUrlHostForAddress } from "../../startupAccess.ts";

// What a phone's way in over Tailscale takes from upstream: where this
// server listens, the tailnet HTTPS port the person chose in Settings ›
// Connections, and the app's own data folder.

/** The loopback host that reaches a server listening on `address`, as a URL host. */
export const localHostFor = loopbackUrlHostForAddress;

/** This server's loopback address and the tailnet port in front of it; null on a socket path. */
export const servePorts = Effect.gen(function* () {
  const server = yield* HttpServer.HttpServer;
  const config = yield* ServerConfig.ServerConfig;
  const address = server.address;
  if (typeof address === "string" || !("port" in address)) return null;
  return {
    localHost: localHostFor(address),
    localPort: address.port,
    servePort: config.tailscaleServePort,
  };
});

/** The mark that the person turned phones over Tailscale on: kept across restarts. */
export const onMarkPath = Effect.gen(function* () {
  const config = yield* ServerConfig.ServerConfig;
  const path = yield* Path.Path;
  return path.join(config.stateDir, "stemcells", "tailscale-serve");
});
