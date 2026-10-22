import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import * as ModelManifest from "../../provider/ModelManifest.ts";

// What Stemcells takes from upstream's model list: the manifest bundled into
// the build, and the catalog the providers read from it. Not its refresh,
// which asks T3's GitHub repository for a newer list every hour; each
// upstream sync brings the newer bundled one instead.

/** Upstream's model list service, always the bundled manifest: it needs no HTTP client. */
const bundled: Layer.Layer<ModelManifest.ModelManifest> = Layer.succeed(
  ModelManifest.ModelManifest,
  ModelManifest.ModelManifest.of({
    current: Effect.succeed(ModelManifest.BUNDLED_MODEL_MANIFEST),
    refresh: Effect.succeed(ModelManifest.BUNDLED_MODEL_MANIFEST),
    forceRefresh: Effect.succeed(ModelManifest.BUNDLED_MODEL_MANIFEST),
    refreshInBackground: Effect.void,
  }),
);

/** The model list and catalog server.ts provides in place of upstream's fetching ones. */
export const bundledModelList = ModelManifest.layerModelCatalog.pipe(Layer.provideMerge(bundled));
