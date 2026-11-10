import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import { HttpRouter, HttpServerRequest, HttpServerResponse } from "effect/http";

import { withReadAccess } from "../upstream/disk.ts";
import * as Ledger from "./Ledger.ts";

// GET /api/stemcells/ledger: the facts kept about this machine's Cells, in the order they
// were recorded, a page at a time. `threads=a,b` reads those chats alone; `after` is the last
// `seq` already held and `limit` the page's size. Read only: nothing asks the ledger to change.

const LEDGER_PATH = "/api/stemcells/ledger";
const PAGE = 500;
const LARGEST_PAGE = 2000;
/** A page of chats asked for by id: more than a screen lists, less than a URL can't carry. */
const MOST_THREADS = 200;

/** A whole number from the query, or `otherwise` when it is missing or isn't one. */
function wholeOf(words: string | null, otherwise: number): number {
  const read = words === null ? Number.NaN : Number(words);
  return Number.isInteger(read) && read >= 0 ? read : otherwise;
}

const ledgerRoute = Effect.gen(function* () {
  const ledger = yield* Ledger.Ledger;
  const url = HttpServerRequest.toURL(yield* HttpServerRequest.HttpServerRequest);
  const param = (name: string) =>
    Option.getOrNull(Option.map(url, (each) => each.searchParams.get(name)));
  const asked = param("threads");
  const threads = asked === null ? null : asked.split(",").filter((id) => id !== "");
  if (threads !== null && (threads.length === 0 || threads.length > MOST_THREADS)) {
    return HttpServerResponse.text(`Expected 1 to ${MOST_THREADS} thread ids in "threads".`, {
      status: 400,
    });
  }
  const page = yield* ledger.page({
    after: wholeOf(param("after"), 0),
    limit: Math.min(LARGEST_PAGE, Math.max(1, wholeOf(param("limit"), PAGE))),
    threads,
  });
  return HttpServerResponse.jsonUnsafe(page, { headers: { "cache-control": "private, no-store" } });
}).pipe(
  Effect.catchTags({
    LedgerReadError: () =>
      Effect.succeed(HttpServerResponse.text("Could not read the ledger.", { status: 503 })),
  }),
);

export const layer = HttpRouter.use((router) =>
  Effect.gen(function* () {
    const ledger = yield* Ledger.Ledger;
    yield* router.add(
      "GET",
      LEDGER_PATH,
      withReadAccess(ledgerRoute.pipe(Effect.provideService(Ledger.Ledger, ledger))),
    );
  }),
).pipe(Layer.provide(Ledger.layer));
