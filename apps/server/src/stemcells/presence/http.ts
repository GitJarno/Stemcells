import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Schedule from "effect/Schedule";
import { HttpRouter, HttpServerResponse } from "effect/http";

import * as UpstreamDisk from "../upstream/disk.ts";
import { readPresence, WATCH_EVERY } from "./presence.ts";

// GET /api/stemcells/presence: whether somebody is at this Mac, polled by
// Aski's figure so its eyes say when nobody is (`- -`). The server reads it
// every minute besides, for as long as it runs, so it knows how long
// somebody was away even while no page asked.

const PRESENCE_PATH = "/api/stemcells/presence";
const NO_STORE = { "cache-control": "private, no-store" };

const presenceRoute = Effect.gen(function* () {
  const platform = yield* UpstreamDisk.HostPlatform;
  const presence = yield* Effect.promise(() => readPresence(platform));
  return HttpServerResponse.jsonUnsafe(presence, { headers: NO_STORE });
});

const watching = Layer.effectDiscard(
  Effect.gen(function* () {
    const platform = yield* UpstreamDisk.HostPlatform;
    if (platform !== "darwin") return;
    yield* Effect.promise(() => readPresence(platform)).pipe(
      Effect.repeat(Schedule.spaced(WATCH_EVERY)),
      Effect.forkScoped,
    );
  }),
);

export const layer = Layer.merge(
  HttpRouter.use((router) =>
    router.add("GET", PRESENCE_PATH, UpstreamDisk.withReadAccess(presenceRoute)),
  ),
  watching,
);
