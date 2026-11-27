import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import { HttpRouter, HttpServerRequest, HttpServerResponse } from "effect/http";

import { RECALL_PATH, type RecallState } from "../../../../../stemcells/recall/card.ts";
import { withReadAccess } from "../upstream/disk.ts";
import * as Recall from "./Recall.ts";

// GET /api/stemcells/recall: the Cells a question finds, as their cards, for the person's own
// clients: every project. `query` is their words; `from` and `to` a window the client read by
// its own clock (else the server reads the words' time); `project` a name, by ear; `state`
// awake, asleep or both; `limit` how many cards.

const LIMIT = 6;
const LARGEST_LIMIT = 50;
/** A question, not a document: what a person says in one breath. */
const LONGEST_QUERY = 2000;

/** A time from the query: epoch milliseconds or a date; null when missing or unreadable. */
function timeOf(words: string | null): number | null {
  if (words === null || words === "") return null;
  const read = /^\d+$/.test(words) ? Number(words) : Date.parse(words);
  return Number.isFinite(read) ? read : null;
}

const STATES: ReadonlySet<string> = new Set<RecallState>(["awake", "asleep", "both"]);

const recallRoute = Effect.gen(function* () {
  const recall = yield* Recall.Recall;
  const url = HttpServerRequest.toURL(yield* HttpServerRequest.HttpServerRequest);
  const param = (name: string) =>
    Option.getOrNull(Option.map(url, (each) => each.searchParams.get(name)));
  const state = param("state") ?? "both";
  const limit = Number(param("limit") ?? LIMIT);
  if (!STATES.has(state) || !Number.isInteger(limit) || limit < 1) {
    return HttpServerResponse.text(`Expected "state" awake, asleep or both, and a "limit".`, {
      status: 400,
    });
  }
  const answer = yield* recall.search({
    query: (param("query") ?? "").slice(0, LONGEST_QUERY),
    from: timeOf(param("from")),
    to: timeOf(param("to")),
    project: param("project"),
    state: state as RecallState,
    limit: Math.min(LARGEST_LIMIT, limit),
    scope: "all",
  });
  return HttpServerResponse.jsonUnsafe(answer, {
    headers: { "cache-control": "private, no-store" },
  });
}).pipe(
  Effect.catchTags({
    RecallReadError: () =>
      Effect.succeed(HttpServerResponse.text("Could not read the Cells' cards.", { status: 503 })),
  }),
);

export const layer = HttpRouter.use((router) =>
  Effect.gen(function* () {
    const recall = yield* Recall.Recall;
    yield* router.add(
      "GET",
      RECALL_PATH,
      withReadAccess(recallRoute.pipe(Effect.provideService(Recall.Recall, recall))),
    );
  }),
).pipe(Layer.provide(Recall.layer));
