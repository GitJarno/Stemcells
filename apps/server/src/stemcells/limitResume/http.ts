import * as Clock from "effect/Clock";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";
import { HttpRouter, HttpServerRequest, HttpServerResponse } from "effect/http";

import * as UpstreamDisk from "../upstream/disk.ts";
import { DRAFTS_MAX_THREADS } from "./drafts.ts";
import * as LimitResume from "./LimitResume.ts";

// POST /api/stemcells/limit-resume/drafts: a screen's chats with words in a
// composer, `{ screen, threadIds }`, its whole list each time. A Cell a
// usage limit stopped never carries on by itself while one is listed. A
// report can only hold a resume back, never cause one, so reading access
// is enough to send it.

const DRAFTS_PATH = "/api/stemcells/limit-resume/drafts";

const Report = Schema.Struct({
  screen: Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(100)),
  threadIds: Schema.Array(Schema.String.check(Schema.isMaxLength(200))).check(
    Schema.isMaxLength(DRAFTS_MAX_THREADS),
  ),
});

const draftsRoute = Effect.gen(function* () {
  const resume = yield* LimitResume.LimitResume;
  const report = yield* HttpServerRequest.schemaBodyJson(Report).pipe(Effect.option);
  if (report._tag === "None") {
    return HttpServerResponse.text("Expected { screen, threadIds }.", { status: 400 });
  }
  resume.drafts.report(report.value.screen, report.value.threadIds, yield* Clock.currentTimeMillis);
  return HttpServerResponse.empty({ status: 204 });
});

export const layer = HttpRouter.use((router) =>
  Effect.gen(function* () {
    const resume = yield* LimitResume.LimitResume;
    yield* router.add(
      "POST",
      DRAFTS_PATH,
      UpstreamDisk.withReadAccess(
        draftsRoute.pipe(Effect.provideService(LimitResume.LimitResume, resume)),
      ),
    );
  }),
).pipe(Layer.provide(LimitResume.layer));
