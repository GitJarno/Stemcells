/**
 * Upstream's server as our tests stand on it: a caller's scopes, the config
 * and the settings. Tests outside the adapter take these here, so a change
 * of upstream's shape is mended once.
 */
import { AuthOrchestrationOperateScope, AuthOrchestrationReadScope } from "@t3tools/contracts";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import * as EnvironmentAuth from "../../auth/EnvironmentAuth.ts";
import * as ServerConfig from "../../config.ts";
import * as ServerSettings from "../../serverSettings.ts";

export { AuthOrchestrationOperateScope, AuthOrchestrationReadScope };

/** A caller's scopes ride a test header; none is no credential. */
export const scopedAuth = Layer.succeed(EnvironmentAuth.EnvironmentAuth, {
  authenticateHttpRequest: (request: { readonly headers: Record<string, string | undefined> }) => {
    const scopes = request.headers["x-test-scopes"];
    return scopes === undefined
      ? Effect.fail(new EnvironmentAuth.ServerAuthMissingCredentialError())
      : Effect.succeed({
          sessionId: "session",
          subject: "test",
          method: "browser-session-cookie",
          scopes: scopes.split(",").filter(Boolean),
        });
  },
} as never);

/** Upstream's test config, its folders under the one named or a fresh one. */
export const configLayerTest = ServerConfig.layerTest;

/** A config that knows only its state folder. */
export const configAt = (stateDir: string) =>
  Layer.succeed(ServerConfig.ServerConfig, { stateDir } as never);

/** Upstream's settings, on their defaults. */
export const settingsLayerTest = ServerSettings.layerTest;
