import * as NodeServices from "@effect/platform-node/NodeServices";
import { assert, it } from "@effect/vitest";
import * as BitbucketApi from "@t3tools/source-control-bitbucket/server/BitbucketApi";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { HttpClient, HttpClientResponse } from "effect/http";

import * as ServerSettings from "../../serverSettings.ts";
import * as ServerSourceControlHost from "../../sourceControl/ServerSourceControlHost.ts";
import * as GitVcsDriver from "../../vcs/GitVcsDriver.ts";
import * as VcsDriverRegistry from "../../vcs/VcsDriverRegistry.ts";
import * as VcsProcess from "../../vcs/VcsProcess.ts";

// Contract: source control discovery asks Bitbucket who is signed in only
// when a Bitbucket token is configured. Without one the answer is
// "unauthenticated" either way, and the request would only tell Atlassian
// the app is running, each time the command palette opens. If this fails
// after a sync, the probe is sent without a token again.

const layerWith = (requests: Array<{ url: string; authorization: string | undefined }>) =>
  BitbucketApi.layer.pipe(
    Layer.provide(ServerSourceControlHost.layer),
    Layer.provide(Layer.mock(VcsProcess.VcsProcess)({})),
    Layer.provide(Layer.mock(VcsDriverRegistry.VcsDriverRegistry)({})),
    Layer.provide(Layer.mock(GitVcsDriver.GitVcsDriver)({})),
    Layer.provide(
      Layer.succeed(
        HttpClient.HttpClient,
        HttpClient.make((request) =>
          Effect.sync(() => {
            requests.push({ url: request.url, authorization: request.headers.authorization });
            return HttpClientResponse.fromWeb(request, Response.json({ username: "someone" }));
          }),
        ),
      ),
    ),
    Layer.provide(ConfigProvider.layer(ConfigProvider.fromEnv({ env: {} }))),
    Layer.provideMerge(ServerSettings.layerTest()),
    Layer.provideMerge(NodeServices.layer),
  );

it.effect("Bitbucket's sign-in is asked only with a token, and without one nothing is sent", () => {
  const requests: Array<{ url: string; authorization: string | undefined }> = [];
  return Effect.gen(function* () {
    const bitbucket = yield* BitbucketApi.BitbucketApi;
    const settings = yield* ServerSettings.ServerSettingsService;

    assert.strictEqual((yield* bitbucket.probeAuth).status, "unauthenticated");
    assert.strictEqual((yield* bitbucket.probeAuth).status, "unauthenticated");
    assert.deepStrictEqual(requests, []);

    yield* settings.updateSettings({
      sourceControlHosts: { bitbucket: { accessToken: "saved-access-token" } },
    });
    assert.strictEqual((yield* bitbucket.probeAuth).status, "authenticated");
    assert.deepStrictEqual(requests, [
      { url: "https://api.bitbucket.org/2.0/user", authorization: "Bearer saved-access-token" },
    ]);
  }).pipe(Effect.provide(layerWith(requests)));
});
