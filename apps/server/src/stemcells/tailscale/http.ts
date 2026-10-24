import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { HttpRouter, HttpServerResponse } from "effect/http";

import * as UpstreamDisk from "../upstream/disk.ts";
import * as StemcellsTailscale from "./StemcellsTailscale.ts";

// GET /api/stemcells/tailscale: where a phone's way in over Tailscale
// stands, polled while Add › Phone or tablet is open.
// POST …/advance: the next step taken for the person.
// POST …/off: phones stop reaching this computer over Tailscale.
// Changing who can reach this computer asks what pairing a device asks.

const TAILSCALE_PATH = "/api/stemcells/tailscale";
const NO_STORE = { "cache-control": "private, no-store" };

const json = (body: unknown) => HttpServerResponse.jsonUnsafe(body, { headers: NO_STORE });

export const layer = HttpRouter.use((router) =>
  Effect.gen(function* () {
    const tailscale = yield* StemcellsTailscale.StemcellsTailscale;
    yield* router.add(
      "GET",
      TAILSCALE_PATH,
      UpstreamDisk.withReadAccess(Effect.map(tailscale.look(), json)),
    );
    yield* router.add(
      "POST",
      `${TAILSCALE_PATH}/advance`,
      UpstreamDisk.withAccessWrite(Effect.map(tailscale.advance(), json)),
    );
    yield* router.add(
      "POST",
      `${TAILSCALE_PATH}/off`,
      UpstreamDisk.withAccessWrite(Effect.map(tailscale.turnOff(), json)),
    );
  }),
).pipe(Layer.provide(StemcellsTailscale.layer));
