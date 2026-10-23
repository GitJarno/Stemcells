import * as Effect from "effect/Effect";
import { HttpRouter, HttpServerResponse } from "effect/http";

import { withReadAccess } from "../upstream/disk.ts";
import { readPricing, readSpendRows } from "../upstream/spend.ts";
import { spendByThread } from "./spend.ts";

// GET /api/stemcells/spend: what each chat on this machine has spent, for
// Settings › Lineage, which adds a name's lives up. Asked as the page opens;
// `since` is when the first counted turn started, as chats before it were
// never counted.

const SPEND_PATH = "/api/stemcells/spend";

const spendRoute = Effect.gen(function* () {
  const [{ since, rows }, pricing] = yield* Effect.all([readSpendRows, readPricing], {
    concurrency: 2,
  });
  return HttpServerResponse.jsonUnsafe(
    { since, threads: spendByThread(rows, pricing) },
    { headers: { "cache-control": "private, no-store" } },
  );
}).pipe(
  Effect.catchTags({
    SqlError: () =>
      Effect.succeed(HttpServerResponse.text("Could not read the chats' spend.", { status: 503 })),
  }),
);

export const layer = HttpRouter.use((router) =>
  router.add("GET", SPEND_PATH, withReadAccess(spendRoute)),
);
