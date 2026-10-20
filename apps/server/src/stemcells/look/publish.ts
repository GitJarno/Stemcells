import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import * as UpstreamTheme from "../upstream/theme.ts";
import { STEMCELLS_THEME_ID, STEMCELLS_THEME_JSON } from "./theme.ts";

// On start, the server publishes Stemcells' theme among the environment's
// themes. The first publish also opens a server with no theme of its own on
// it; after that the default is the person's, so a cleared one stays cleared.

export const publishLook = Effect.gen(function* () {
  const published = yield* UpstreamTheme.readPublishedTheme(STEMCELLS_THEME_ID);
  if (published === STEMCELLS_THEME_JSON) return;
  yield* UpstreamTheme.publishTheme(STEMCELLS_THEME_ID, STEMCELLS_THEME_JSON);
  if (published === null) {
    yield* UpstreamTheme.adoptDefaultThemeWhenUnset(STEMCELLS_THEME_ID);
  }
});

/** Without the theme the app still works in T3's colours, so a failure only warns. */
export const layer = Layer.effectDiscard(
  publishLook.pipe(
    Effect.catchCause((cause) => Effect.logWarning("Stemcells: theme not published", { cause })),
  ),
);
