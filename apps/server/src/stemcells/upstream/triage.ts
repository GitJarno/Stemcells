import { ServerPrepareTriageError } from "@t3tools/contracts";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import { TriageService } from "../../triage/TriageService.ts";

// Upstream's in-app triage clones T3's repository and has the person's agent file the problem,
// with the client's OS, browser and version, on T3's tracker. Stemcells offers none: its server
// says it has no triage (`ServerEnvironment.ts`), and this answers a call that asks anyway.

/** Upstream's triage service, preparing nothing. It needs no service, so it can't reach git. */
export const noTriage: Layer.Layer<TriageService> = Layer.succeed(
  TriageService,
  TriageService.of({
    prepare: Effect.fn("TriageService.prepare")(() =>
      Effect.fail(new ServerPrepareTriageError({})),
    ),
  }),
);
