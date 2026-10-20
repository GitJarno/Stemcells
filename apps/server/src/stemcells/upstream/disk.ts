import { AuthOrchestrationReadScope } from "@t3tools/contracts";
import * as HostProcess from "@t3tools/shared/HostProcess";
import * as Effect from "effect/Effect";
import { HttpServerRequest, HttpServerRespondable, type HttpServerResponse } from "effect/http";

import * as EnvironmentAuth from "../../auth/EnvironmentAuth.ts";
import {
  failEnvironmentAuthInvalid,
  failEnvironmentInternal,
  failEnvironmentScopeRequired,
} from "../../auth/http.ts";
import * as ServerConfig from "../../config.ts";
import * as ProjectStore from "../../orchestration-v2/ProjectStore.ts";

// What Settings › Disk takes from upstream: its request authentication, the
// projects the person added, and where this app keeps its state.

/**
 * Upstream's 401 or 403 for a caller who may not read this environment,
 * checked as upstream's own raw routes check it; nothing for one who may.
 */
const refusal = Effect.gen(function* () {
  const request = yield* HttpServerRequest.HttpServerRequest;
  const serverAuth = yield* EnvironmentAuth.EnvironmentAuth;
  const session = yield* serverAuth.authenticateHttpRequest(request).pipe(
    Effect.catchIf(EnvironmentAuth.isServerAuthCredentialError, (error) =>
      failEnvironmentAuthInvalid(
        EnvironmentAuth.serverAuthCredentialReason(error),
        EnvironmentAuth.serverAuthDpopFailureReason(error),
      ),
    ),
    Effect.catchIf(EnvironmentAuth.isServerAuthInternalError, (error) =>
      failEnvironmentInternal("internal_error", error),
    ),
  );
  if (!session.scopes.includes(AuthOrchestrationReadScope)) {
    return yield* failEnvironmentScopeRequired(AuthOrchestrationReadScope);
  }
  return null;
}).pipe(
  Effect.catchTags({
    EnvironmentAuthInvalidError: HttpServerRespondable.toResponse,
    EnvironmentInternalError: HttpServerRespondable.toResponse,
    EnvironmentScopeRequiredError: HttpServerRespondable.toResponse,
  }),
);

/** Runs `handler` only for a caller allowed to read this environment. */
export const withReadAccess = <E, R>(
  handler: Effect.Effect<HttpServerResponse.HttpServerResponse, E, R>,
) => Effect.flatMap(refusal, (refused) => (refused === null ? handler : Effect.succeed(refused)));

/** The platform the server runs on, as upstream injects it. */
export const HostPlatform = HostProcess.Platform;

export interface KnownFolders {
  /** Workspace roots of the projects the person added. */
  readonly projects: ReadonlyArray<string>;
  /** This app's state folder (`~/.stemcells`, or the dev home). */
  readonly ownState: ReadonlyArray<string>;
}

/** A reader of the known folders, current each time it runs. */
export const knownFoldersReader = Effect.gen(function* () {
  const projectStore = yield* ProjectStore.ProjectStoreV2;
  const config = yield* ServerConfig.ServerConfig;
  return projectStore.listShells().pipe(
    Effect.map((shells): KnownFolders => ({
      projects: shells.map((shell) => shell.workspaceRoot),
      ownState: [config.baseDir],
    })),
    // Without the project list the walk still measures everything else.
    Effect.catchTags({
      ProjectStoreV2Error: (error) =>
        Effect.logWarning("Disk: projects unavailable", { operation: error.operation }).pipe(
          Effect.as<KnownFolders>({ projects: [], ownState: [config.baseDir] }),
        ),
    }),
  );
});
