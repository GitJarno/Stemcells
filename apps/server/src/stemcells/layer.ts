import * as Layer from "effect/Layer";

import * as ArcsHttp from "./arcs/http.ts";
import * as AsksHttp from "./asks/http.ts";
import * as AttachmentsHttp from "./attachments/http.ts";
import * as AutonomyHttp from "./autonomy/http.ts";
import * as DiskHttp from "./disk/http.ts";
import * as LimitResumeHttp from "./limitResume/http.ts";
import * as Look from "./look/publish.ts";
import * as NeedsHttp from "./needs/http.ts";
import * as OnTheWire from "./peers/onTheWire.ts";
import * as PeersHttp from "./peers/http.ts";
import * as PlannerHttp from "./planner/http.ts";
import * as PresenceHttp from "./presence/http.ts";
import * as PushHttp from "./push/http.ts";
import * as Privacy from "./privacy/telemetry.ts";
import * as MergeDefault from "./settle/mergeDefault.ts";
import * as SpendHttp from "./spend/http.ts";
import * as SuggestionHttp from "./suggestions/http.ts";
import * as TailscaleHttp from "./tailscale/http.ts";
import * as ModelList from "./upstream/modelList.ts";
import * as Triage from "./upstream/triage.ts";

// Everything Stemcells adds to the server, mounted by one line in server.ts. Each module
// says what it adds.

export const layer = Layer.mergeAll(
  ArcsHttp.layer,
  AsksHttp.layer,
  AttachmentsHttp.layer,
  AutonomyHttp.layer,
  DiskHttp.layer,
  PresenceHttp.layer,
  PushHttp.layer,
  NeedsHttp.layer,
  PlannerHttp.layer,
  LimitResumeHttp.layer,
  PeersHttp.layer,
  OnTheWire.layer,
  SuggestionHttp.layer,
  SpendHttp.layer,
  TailscaleHttp.layer,
  Look.layer,
  MergeDefault.layer,
  Privacy.layer,
);

/** The analytics service server.ts provides in place of upstream's: records nothing. */
export const analytics = Privacy.analytics;

/** The model list server.ts provides in place of upstream's: the bundled one, never fetched. */
export const modelList = ModelList.bundledModelList;

/** The triage service server.ts provides in place of upstream's: prepares nothing. */
export const triage = Triage.noTriage;
