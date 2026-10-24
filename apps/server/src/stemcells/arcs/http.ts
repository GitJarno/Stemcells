import * as Clock from "effect/Clock";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import { HttpRouter, HttpServerResponse } from "effect/http";

import { readArcRecords } from "../upstream/arcs.ts";
import { withReadAccess } from "../upstream/disk.ts";
import { weekOf, weeksOf } from "./arcs.ts";

// GET /api/stemcells/arcs: how the person's work with Cells went, week by
// week, for the last eight weeks: worked out from T3's records when asked,
// never kept.

const ARCS_PATH = "/api/stemcells/arcs";
const WEEKS = 8;

const arcsRoute = Effect.gen(function* () {
  const now = yield* Clock.currentTimeMillis;
  const from = Date.parse(weekOf(now - (WEEKS - 1) * 7 * 24 * 60 * 60 * 1000));
  const records = yield* readArcRecords(DateTime.formatIso(DateTime.makeUnsafe(from)));
  return HttpServerResponse.jsonUnsafe(
    { weeks: weeksOf(records, from, now) },
    { headers: { "cache-control": "private, no-store" } },
  );
}).pipe(
  Effect.catchTags({
    SqlError: () =>
      Effect.succeed(
        HttpServerResponse.text("Could not read the Cells' records.", { status: 503 }),
      ),
  }),
);

export const layer = HttpRouter.use((router) =>
  router.add("GET", ARCS_PATH, withReadAccess(arcsRoute)),
);
