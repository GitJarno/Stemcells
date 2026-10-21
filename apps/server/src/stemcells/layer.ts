import * as Layer from "effect/Layer";

import * as AttachmentsHttp from "./attachments/http.ts";
import * as DiskHttp from "./disk/http.ts";
import * as LimitResumeHttp from "./limitResume/http.ts";
import * as Look from "./look/publish.ts";
import * as NeedsHttp from "./needs/http.ts";
import * as PlannerHttp from "./planner/http.ts";
import * as PresenceHttp from "./presence/http.ts";
import * as Privacy from "./privacy/telemetry.ts";

// Everything Stemcells adds to the server, mounted by one line in server.ts:
// a file one chat shows brought into another's draft, Settings › Disk's
// routes, whether somebody is at this Mac for Aski's eyes, what needs the
// person for Aski's page, Aski's planner, Cells carrying on after a usage
// limit (and the drafts that hold them), the theme published on start, and
// the telemetry id upstream left behind, removed on start.

export const layer = Layer.mergeAll(
  AttachmentsHttp.layer,
  DiskHttp.layer,
  PresenceHttp.layer,
  NeedsHttp.layer,
  PlannerHttp.layer,
  LimitResumeHttp.layer,
  Look.layer,
  Privacy.layer,
);

/** The analytics service server.ts provides in place of upstream's: records nothing. */
export const analytics = Privacy.analytics;
