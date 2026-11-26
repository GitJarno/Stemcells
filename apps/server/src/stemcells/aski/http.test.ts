import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { HttpRouter } from "effect/http";
import { describe, expect, it } from "vite-plus/test";

import { ASKI_FRESH_PATH } from "../../../../../stemcells/aski/show.ts";
import * as AskiFresh from "../upstream/askiFresh.ts";
import {
  AuthOrchestrationOperateScope,
  AuthOrchestrationReadScope,
  scopedAuth,
} from "../upstream/server.fixture.ts";
import { routes } from "./http.ts";

// Contract: New Aski answers only a caller who may start work here, as upstream's commands
// that start a chat and settle one ask; a server with no Aski chat yet says so.

const serve = (fresh: AskiFresh.AskiFresh["Service"]["fresh"]) =>
  HttpRouter.toWebHandler(
    routes.pipe(
      Layer.provideMerge(Layer.mergeAll(scopedAuth, Layer.succeed(AskiFresh.AskiFresh, { fresh }))),
    ),
    { disableLogger: true },
  );

const post = (scopes: string | null) =>
  new Request(`http://127.0.0.1${ASKI_FRESH_PATH}`, {
    method: "POST",
    headers: scopes === null ? {} : { "x-test-scopes": scopes },
  });

describe("New Aski's route", () => {
  it("starts a fresh Aski only for a caller who may start work", async () => {
    let made = 0;
    const web = serve(
      Effect.sync(() => {
        made += 1;
        return { threadId: "thread-fresh" as never };
      }),
    );
    try {
      expect((await web.handler(post(null))).status).toBe(401);
      expect((await web.handler(post(AuthOrchestrationReadScope))).status).toBe(403);
      expect(made).toBe(0);
      const answered = await web.handler(post(AuthOrchestrationOperateScope));
      expect(answered.status).toBe(200);
      expect(await answered.json()).toEqual({ threadId: "thread-fresh" });
      expect(made).toBe(1);
    } finally {
      await web.dispose();
    }
  });

  it("answers 409 where Aski has no chat to start afresh from", async () => {
    const web = serve(
      Effect.fail(new AskiFresh.AskiFreshError({ reason: "no-aski", message: "No Aski chat." })),
    );
    try {
      const answered = await web.handler(post(AuthOrchestrationOperateScope));
      expect(answered.status).toBe(409);
      expect(await answered.text()).toBe("No Aski chat.");
    } finally {
      await web.dispose();
    }
  });
});
