import * as Effect from "effect/Effect";
import { HttpRouter, HttpServerResponse } from "effect/http";

import * as UpstreamDisk from "../upstream/disk.ts";
import { readPresence } from "./presence.ts";

// GET /api/stemcells/presence: whether somebody is at this Mac, polled by
// Aski's figure so its eyes say when nobody is (`- -`).

const PRESENCE_PATH = "/api/stemcells/presence";
const NO_STORE = { "cache-control": "private, no-store" };

const presenceRoute = Effect.gen(function* () {
  const platform = yield* UpstreamDisk.HostPlatform;
  const presence = yield* Effect.promise(() => readPresence(platform));
  return HttpServerResponse.jsonUnsafe(presence, { headers: NO_STORE });
});

export const layer = HttpRouter.use((router) =>
  router.add("GET", PRESENCE_PATH, UpstreamDisk.withReadAccess(presenceRoute)),
);
