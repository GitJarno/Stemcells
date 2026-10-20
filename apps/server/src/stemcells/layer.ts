import * as Layer from "effect/Layer";

import * as DiskHttp from "./disk/http.ts";
import * as Look from "./look/publish.ts";

// Everything Stemcells adds to the server, mounted by one line in server.ts:
// Settings › Disk's routes, and the theme published on start.

export const layer = Layer.mergeAll(DiskHttp.layer, Look.layer);
