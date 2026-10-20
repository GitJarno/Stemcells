import * as Layer from "effect/Layer";

import * as DiskHttp from "./disk/http.ts";
import * as Look from "./look/publish.ts";
import * as Privacy from "./privacy/telemetry.ts";

// Everything Stemcells adds to the server, mounted by one line in server.ts:
// Settings › Disk's routes, the theme published on start, and the telemetry
// id upstream left behind, removed on start.

export const layer = Layer.mergeAll(DiskHttp.layer, Look.layer, Privacy.layer);

/** The analytics service server.ts provides in place of upstream's: records nothing. */
export const analytics = Privacy.analytics;
