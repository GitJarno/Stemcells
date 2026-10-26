import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";
import * as Stream from "effect/Stream";
import { HttpRouter, HttpServerRequest, HttpServerResponse } from "effect/http";

import * as UpstreamDisk from "../upstream/disk.ts";
import * as Autonomy from "./Autonomy.ts";
import { KINDS } from "./kinds.ts";

// GET /api/stemcells/autonomy: what Aski takes for the person, could offer to, and is about
// to take, as JSON; GET .../stream: the same as server-sent events, on connect and each change.
// POST /api/stemcells/autonomy: `{ grant | decline: kind }` or `{ keep: key }`.
// Granting lets Aski answer Cells, so it needs the access that answers them.

const PATH = "/api/stemcells/autonomy";
const NO_STORE = { "cache-control": "private, no-store" };
/** Keeps proxies and sleeping sockets from closing a quiet stream. */
const BEAT = Duration.seconds(20);

const Kind = Schema.Literals(KINDS);
const Change = Schema.Union([
  Schema.Struct({ grant: Kind }),
  Schema.Struct({ decline: Kind }),
  Schema.Struct({ keep: Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(500)) }),
]);

const encoder = new TextEncoder();

const viewRoute = Effect.gen(function* () {
  const autonomy = yield* Autonomy.Autonomy;
  return HttpServerResponse.jsonUnsafe(yield* autonomy.view, { headers: NO_STORE });
});

const streamRoute = Effect.gen(function* () {
  const autonomy = yield* Autonomy.Autonomy;
  const events = Stream.merge(
    Stream.map(autonomy.changes, (view) => `data: ${JSON.stringify(view)}\n\n`),
    Stream.map(Stream.tick(BEAT), () => ": beat\n\n"),
  );
  return HttpServerResponse.stream(
    Stream.map(events, (event) => encoder.encode(event)),
    {
      contentType: "text/event-stream",
      // no-transform keeps compression from holding events back.
      headers: { "cache-control": "no-cache, no-transform", "x-accel-buffering": "no" },
    },
  );
});

const changeRoute = Effect.gen(function* () {
  const autonomy = yield* Autonomy.Autonomy;
  const change = yield* HttpServerRequest.schemaBodyJson(Change).pipe(Effect.option);
  if (change._tag === "None") {
    return HttpServerResponse.text("Expected { grant }, { decline } or { keep }.", { status: 400 });
  }
  const body = change.value;
  yield* "grant" in body
    ? autonomy.grant(body.grant)
    : "decline" in body
      ? autonomy.decline(body.decline)
      : autonomy.keep(body.keep);
  return HttpServerResponse.jsonUnsafe(yield* autonomy.view, { headers: NO_STORE });
});

export const layer = HttpRouter.use((router) =>
  Effect.gen(function* () {
    const autonomy = yield* Autonomy.Autonomy;
    const provide = <E, R>(route: Effect.Effect<HttpServerResponse.HttpServerResponse, E, R>) =>
      route.pipe(Effect.provideService(Autonomy.Autonomy, autonomy));
    yield* router.add("GET", PATH, UpstreamDisk.withReadAccess(provide(viewRoute)));
    yield* router.add("GET", `${PATH}/stream`, UpstreamDisk.withReadAccess(provide(streamRoute)));
    yield* router.add("POST", PATH, UpstreamDisk.withOperateAccess(provide(changeRoute)));
  }),
).pipe(Layer.provide(Autonomy.layer));
