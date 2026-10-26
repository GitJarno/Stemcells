import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";
import { HttpRouter, HttpServerRequest, HttpServerResponse } from "effect/http";

import * as UpstreamDisk from "../upstream/disk.ts";
import * as Asks from "./Asks.ts";

// POST /api/stemcells/asks: `{ key, did, note?, shown? }`, what the person did with an ask.
// GET /api/stemcells/asks/measure: each kind's asks of the last week, and how many were
// answered from the ask alone. Both stay on this Mac.

const PATH = "/api/stemcells/asks";
const NO_STORE = { "cache-control": "private, no-store" };

const Told = Schema.Struct({
  key: Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(500)),
  did: Schema.Literals(["answered", "opened", "flagged"]),
  note: Schema.optionalKey(Schema.String.check(Schema.isMaxLength(2000))),
  shown: Schema.optionalKey(
    Schema.Struct({
      ask: Schema.String.check(Schema.isMaxLength(2000)),
      context: Schema.NullOr(Schema.String.check(Schema.isMaxLength(20000))),
    }),
  ),
});

const tellRoute = Effect.gen(function* () {
  const asks = yield* Asks.Asks;
  const told = yield* HttpServerRequest.schemaBodyJson(Told).pipe(Effect.option);
  if (told._tag === "None") {
    return HttpServerResponse.text("Expected { key, did, note?, shown? }.", { status: 400 });
  }
  const { key, did, note, shown } = told.value;
  yield* asks.mark(key, did, note ?? null, shown ?? null);
  return HttpServerResponse.empty({ status: 204 });
});

const measureRoute = Effect.gen(function* () {
  const asks = yield* Asks.Asks;
  return HttpServerResponse.jsonUnsafe(yield* asks.measure, { headers: NO_STORE });
});

// Telling needs the access that answers a Cell: a screen that can't answer has nothing to tell.
export const layer = HttpRouter.use((router) =>
  Effect.gen(function* () {
    const asks = yield* Asks.Asks;
    const provide = <E, R>(route: Effect.Effect<HttpServerResponse.HttpServerResponse, E, R>) =>
      route.pipe(Effect.provideService(Asks.Asks, asks));
    yield* router.add("POST", PATH, UpstreamDisk.withOperateAccess(provide(tellRoute)));
    yield* router.add("GET", `${PATH}/measure`, UpstreamDisk.withReadAccess(provide(measureRoute)));
  }),
).pipe(Layer.provide(Asks.layer));
