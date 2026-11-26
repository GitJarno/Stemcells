import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { HttpRouter, HttpServerResponse } from "effect/http";

import { ASKI_FRESH_PATH } from "../../../../../stemcells/aski/show.ts";
import * as AskiFresh from "../upstream/askiFresh.ts";
import * as UpstreamDisk from "../upstream/disk.ts";

// POST /api/stemcells/aski/fresh: a fresh Aski chat, `{ threadId }`; the one before settles.
// It starts a chat and settles one, so it asks the access that dispatches those commands.

const NO_STORE = { "cache-control": "private, no-store" };

const freshRoute = Effect.gen(function* () {
  const aski = yield* AskiFresh.AskiFresh;
  return yield* aski.fresh.pipe(
    Effect.map((made) => HttpServerResponse.jsonUnsafe(made, { headers: NO_STORE })),
    Effect.catchTags({
      AskiFreshError: (error) =>
        Effect.succeed(
          HttpServerResponse.text(error.message, {
            status: error.reason === "no-aski" ? 409 : 500,
            headers: NO_STORE,
          }),
        ),
    }),
  );
});

export const routes = HttpRouter.use((router) =>
  Effect.gen(function* () {
    const aski = yield* AskiFresh.AskiFresh;
    yield* router.add(
      "POST",
      ASKI_FRESH_PATH,
      UpstreamDisk.withOperateAccess(
        freshRoute.pipe(Effect.provideService(AskiFresh.AskiFresh, aski)),
      ),
    );
  }),
);

export const layer = routes.pipe(Layer.provide(AskiFresh.layer));
