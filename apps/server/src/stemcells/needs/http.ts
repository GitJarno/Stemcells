import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Stream from "effect/Stream";
import { HttpRouter, HttpServerResponse } from "effect/http";

import * as UpstreamDisk from "../upstream/disk.ts";
import * as Needs from "./Needs.ts";

// GET /api/stemcells/needs: what needs the person now, as JSON.
// GET /api/stemcells/needs/stream: the same list as server-sent events, sent
// whole on connect and on every change. A reconnect gets the whole list,
// which is the truth: cards whose key is gone resolve.

const NEEDS_PATH = "/api/stemcells/needs";
const NO_STORE = { "cache-control": "private, no-store" };
/** Keeps proxies and sleeping sockets from closing a quiet stream. */
const BEAT = Duration.seconds(20);

const encoder = new TextEncoder();

const listRoute = Effect.gen(function* () {
  const needs = yield* Needs.Needs;
  return HttpServerResponse.jsonUnsafe(yield* needs.list, { headers: NO_STORE });
});

const streamRoute = Effect.gen(function* () {
  const needs = yield* Needs.Needs;
  const events = Stream.merge(
    Stream.map(needs.changes, (list) => `data: ${JSON.stringify(list)}\n\n`),
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

export const layer = HttpRouter.use((router) =>
  Effect.gen(function* () {
    const needs = yield* Needs.Needs;
    const serve = <E, R>(route: Effect.Effect<HttpServerResponse.HttpServerResponse, E, R>) =>
      UpstreamDisk.withReadAccess(route.pipe(Effect.provideService(Needs.Needs, needs)));
    yield* router.add("GET", NEEDS_PATH, serve(listRoute));
    yield* router.add("GET", `${NEEDS_PATH}/stream`, serve(streamRoute));
  }),
).pipe(Layer.provide(Needs.layer));
