import * as NodeServices from "@effect/platform-node/NodeServices";
import { assert, it } from "@effect/vitest";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { HttpClient, HttpClientResponse } from "effect/http";

import * as ServerSettings from "../../serverSettings.ts";
import * as SourceControlDrivers from "../../sourceControl/builtInDrivers.ts";
import * as GitVcsDriver from "../../vcs/GitVcsDriver.ts";
import * as VcsDriverRegistry from "../../vcs/VcsDriverRegistry.ts";
import * as VcsProcess from "../../vcs/VcsProcess.ts";

// Contract: source control discovery (the server's drivers, as the command palette reads
// them) asks Bitbucket who is signed in only when a Bitbucket token is configured. Without
// one the answer is "unauthenticated" anyway, and the request would only tell Atlassian the
// app is running each time the palette opens. If this fails, the tokenless probe is back.

const layerWith = (requests: Array<{ url: string; authorization: string | undefined }>) =>
  SourceControlDrivers.layer.pipe(
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
    const drivers = yield* SourceControlDrivers.SourceControlDrivers;
    const discovery = drivers.find((entry) => entry.driver.kind === "bitbucket")?.instance
      .discovery;
    assert.strictEqual(discovery?.type, "api");
    if (discovery?.type !== "api") return;
    const bitbucket = discovery;
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
  }).pipe(Effect.provide(layerWith(requests)), Effect.scoped);
});
