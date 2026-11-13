import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import { HttpRouter, HttpServerRequest, HttpServerResponse } from "effect/http";

import { DEEDS } from "../../../../../stemcells/ledger/feats.ts";
import { MOST_RECORDS } from "../../../../../stemcells/ledger/marks.ts";
import * as UpstreamDisk from "../upstream/disk.ts";
import * as Collection from "./Collection.ts";
import { MOST_WORN } from "./kept.ts";

// GET /api/stemcells/collection: the feats, the day, what each Cell wears, the feats shown.
// GET /api/stemcells/collection/cells?threads=a,b: the marks those Cells earned in their lives.
// POST /api/stemcells/collection: one change, `{ wear }`, `{ seen }` or `{ deed }`.
// All of it stays on this machine.

const PATH = "/api/stemcells/collection";
const CELLS_PATH = `${PATH}/cells`;
const NO_STORE = { "cache-control": "private, no-store" };

const Id = Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(200));
const Change = Schema.Union([
  Schema.Struct({
    wear: Schema.Struct({
      threadId: Id,
      worn: Schema.Array(Id).check(Schema.isMaxLength(MOST_WORN)),
    }),
  }),
  Schema.Struct({ seen: Schema.Array(Id).check(Schema.isMaxLength(200)) }),
  Schema.Struct({
    deed: Schema.Struct({ deed: Schema.Literals(DEEDS), threadId: Schema.NullOr(Id) }),
  }),
]);

const unread = Effect.succeed(
  HttpServerResponse.text("Could not read the ledger.", { status: 503 }),
);

const readRoute = Effect.gen(function* () {
  const collection = yield* Collection.Collection;
  return HttpServerResponse.jsonUnsafe(yield* collection.read, { headers: NO_STORE });
}).pipe(Effect.catchTags({ LedgerReadError: () => unread }));

const cellsRoute = Effect.gen(function* () {
  const collection = yield* Collection.Collection;
  const url = HttpServerRequest.toURL(yield* HttpServerRequest.HttpServerRequest);
  const asked = Option.getOrNull(Option.map(url, (each) => each.searchParams.get("threads")));
  const threads = (asked ?? "").split(",").filter((id) => id !== "");
  if (threads.length === 0 || threads.length > MOST_RECORDS) {
    return HttpServerResponse.text(`Expected 1 to ${MOST_RECORDS} thread ids in "threads".`, {
      status: 400,
    });
  }
  return HttpServerResponse.jsonUnsafe(yield* collection.records(threads), { headers: NO_STORE });
}).pipe(Effect.catchTags({ LedgerReadError: () => unread }));

const changeRoute = Effect.gen(function* () {
  const collection = yield* Collection.Collection;
  const change = yield* HttpServerRequest.schemaBodyJson(Change).pipe(Effect.option);
  if (change._tag === "None") {
    return HttpServerResponse.text("Expected { wear }, { seen } or { deed }.", { status: 400 });
  }
  yield* collection.change(change.value);
  return HttpServerResponse.empty({ status: 204 });
}).pipe(
  Effect.catchTags({
    LedgerReadError: () => unread,
    NotUnlockedError: () =>
      Effect.succeed(HttpServerResponse.text("No feat has unlocked that yet.", { status: 409 })),
  }),
);

// A change needs the access that answers a Cell: a screen that can only read dresses no one.
export const layer = HttpRouter.use((router) =>
  Effect.gen(function* () {
    const collection = yield* Collection.Collection;
    const provide = <E, R>(route: Effect.Effect<HttpServerResponse.HttpServerResponse, E, R>) =>
      route.pipe(Effect.provideService(Collection.Collection, collection));
    yield* router.add("GET", PATH, UpstreamDisk.withReadAccess(provide(readRoute)));
    yield* router.add("GET", CELLS_PATH, UpstreamDisk.withReadAccess(provide(cellsRoute)));
    yield* router.add("POST", PATH, UpstreamDisk.withOperateAccess(provide(changeRoute)));
  }),
).pipe(Layer.provide(Collection.layer));
