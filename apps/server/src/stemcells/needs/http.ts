import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Stream from "effect/Stream";
import { HttpRouter, HttpServerResponse } from "effect/http";

import * as UpstreamDisk from "../upstream/disk.ts";
import * as Needs from "./Needs.ts";

// GET /api/stemcells/needs: what needs the person now, as JSON. `/stream`: the same list as
// server-sent events, whole on connect and on every change; a reconnect's list is the truth.
// `/settles/stream`: its settles by hand alone, the same way, sent only as one comes or goes,
// which every Mac connected here closes its panes by.

const NEEDS_PATH = "/api/stemcells/needs";
const NO_STORE = { "cache-control": "private, no-store" };
/** Keeps proxies and sleeping sockets from closing a quiet stream. */
const BEAT = Duration.seconds(20);

const encoder = new TextEncoder();

const listRoute = Effect.gen(function* () {
  const needs = yield* Needs.Needs;
  return HttpServerResponse.jsonUnsafe(yield* needs.list, { headers: NO_STORE });
});

const eventStream = (values: Stream.Stream<unknown>) => {
  const events = Stream.merge(
    Stream.map(values, (value) => `data: ${JSON.stringify(value)}\n\n`),
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
};

const streamRoute = Effect.gen(function* () {
  const needs = yield* Needs.Needs;
  return eventStream(needs.changes);
});

const settlesRoute = Effect.gen(function* () {
  const needs = yield* Needs.Needs;
  return eventStream(
    needs.changes.pipe(
      Stream.map((list) => ({ settles: list.settles ?? [] })),
      Stream.changes,
    ),
  );
});

export const layer = HttpRouter.use((router) =>
  Effect.gen(function* () {
    const needs = yield* Needs.Needs;
    const serve = <E, R>(route: Effect.Effect<HttpServerResponse.HttpServerResponse, E, R>) =>
      UpstreamDisk.withReadAccess(route.pipe(Effect.provideService(Needs.Needs, needs)));
    yield* router.add("GET", NEEDS_PATH, serve(listRoute));
    yield* router.add("GET", `${NEEDS_PATH}/stream`, serve(streamRoute));
    yield* router.add("GET", `${NEEDS_PATH}/settles/stream`, serve(settlesRoute));
  }),
).pipe(Layer.provide(Needs.layer));
