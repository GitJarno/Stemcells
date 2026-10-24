import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";
import { HttpRouter, HttpServerRequest, HttpServerResponse } from "effect/http";

import * as UpstreamDisk from "../upstream/disk.ts";
import { APPLE_ID, readsAsKey } from "./apns.ts";
import * as Push from "./Push.ts";

// GET /api/stemcells/push: whether a key is set, the phones, how the last
// push went. Never the key.
// POST /api/stemcells/push/devices: a phone asks for pushes; DELETE with
// `{ token }` stops them. A phone that can read this Mac's Cells may hear of them.
// PUT /api/stemcells/push/key: the person's APNs key; DELETE forgets it.
// Changing it changes who can reach their phones, so it asks what pairing does.
// POST /api/stemcells/push/test: a push to every phone now.

const PATH = "/api/stemcells/push";
const NO_STORE = { "cache-control": "private, no-store" };

const Token = Schema.String.check(Schema.isPattern(/^[0-9a-fA-F]{32,200}$/));
const Device = Schema.Struct({
  token: Token,
  environment: Schema.Literals(["development", "production"]),
  // A bundle id: what Apple routes the push to, and the key's team must own.
  topic: Schema.String.check(Schema.isPattern(/^[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+$/)),
  label: Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(80)),
});
const Forget = Schema.Struct({ token: Token });
const Key = Schema.Struct({
  keyId: Schema.String.check(Schema.isPattern(APPLE_ID)),
  teamId: Schema.String.check(Schema.isPattern(APPLE_ID)),
  p8: Schema.String.check(Schema.isMaxLength(4000)),
});

const NOT_KEPT = HttpServerResponse.text("This Mac couldn't write to its secret store.", {
  status: 500,
});

const statusRoute = Effect.gen(function* () {
  const push = yield* Push.Push;
  return HttpServerResponse.jsonUnsafe(yield* push.status, { headers: NO_STORE });
});

const registerRoute = Effect.gen(function* () {
  const push = yield* Push.Push;
  const device = yield* HttpServerRequest.schemaBodyJson(Device).pipe(Effect.option);
  if (device._tag === "None") {
    return HttpServerResponse.text("Expected { token, environment, topic, label }.", {
      status: 400,
    });
  }
  yield* push.register(device.value);
  return HttpServerResponse.empty({ status: 204 });
});

const unregisterRoute = Effect.gen(function* () {
  const push = yield* Push.Push;
  const forget = yield* HttpServerRequest.schemaBodyJson(Forget).pipe(Effect.option);
  if (forget._tag === "None")
    return HttpServerResponse.text("Expected { token }.", { status: 400 });
  yield* push.unregister(forget.value.token);
  return HttpServerResponse.empty({ status: 204 });
});

const setKeyRoute = Effect.gen(function* () {
  const push = yield* Push.Push;
  const key = yield* HttpServerRequest.schemaBodyJson(Key).pipe(Effect.option);
  if (key._tag === "None") {
    return HttpServerResponse.text("A Key ID and Team ID are ten letters and digits.", {
      status: 400,
    });
  }
  if (!readsAsKey(key.value.p8)) {
    return HttpServerResponse.text("That file isn't an APNs key (.p8).", { status: 400 });
  }
  if (!(yield* push.setKey(key.value))) return NOT_KEPT;
  return HttpServerResponse.jsonUnsafe(yield* push.status, { headers: NO_STORE });
});

const forgetKeyRoute = Effect.gen(function* () {
  const push = yield* Push.Push;
  if (!(yield* push.setKey(null))) return NOT_KEPT;
  return HttpServerResponse.jsonUnsafe(yield* push.status, { headers: NO_STORE });
});

const testRoute = Effect.gen(function* () {
  const push = yield* Push.Push;
  const results = yield* push.test;
  return HttpServerResponse.jsonUnsafe(
    { results, status: yield* push.status },
    { headers: NO_STORE },
  );
});

export const layer = HttpRouter.use((router) =>
  Effect.gen(function* () {
    const push = yield* Push.Push;
    const provide = <E, R>(route: Effect.Effect<HttpServerResponse.HttpServerResponse, E, R>) =>
      route.pipe(Effect.provideService(Push.Push, push));
    yield* router.add("GET", PATH, UpstreamDisk.withReadAccess(provide(statusRoute)));
    yield* router.add(
      "POST",
      `${PATH}/devices`,
      UpstreamDisk.withReadAccess(provide(registerRoute)),
    );
    yield* router.add(
      "DELETE",
      `${PATH}/devices`,
      UpstreamDisk.withReadAccess(provide(unregisterRoute)),
    );
    yield* router.add("PUT", `${PATH}/key`, UpstreamDisk.withAccessWrite(provide(setKeyRoute)));
    yield* router.add(
      "DELETE",
      `${PATH}/key`,
      UpstreamDisk.withAccessWrite(provide(forgetKeyRoute)),
    );
    yield* router.add("POST", `${PATH}/test`, UpstreamDisk.withOperateAccess(provide(testRoute)));
  }),
).pipe(Layer.provide(Push.layer));
