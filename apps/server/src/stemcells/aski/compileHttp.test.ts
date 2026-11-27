// @effect-diagnostics anyUnknownInErrorContext:off unsafeEffectTypeAssertion:off - a fake model's answers: values, failures and waits alike.
// @effect-diagnostics nodeBuiltinImport:off - makes the state folder the learned names live in.
import * as NodeFS from "node:fs";
import * as NodeOS from "node:os";
import * as NodePath from "node:path";

import * as NodeServices from "@effect/platform-node/NodeServices";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { HttpRouter } from "effect/http";
import * as Etag from "effect/http/Etag";
import * as HttpPlatform from "effect/http/HttpPlatform";
import { afterAll, beforeEach, describe, expect, it } from "vite-plus/test";

import { instancesOf } from "../upstream/planner.fixture.ts";
import {
  AuthOrchestrationOperateScope,
  AuthOrchestrationReadScope,
  configAt,
  scopedAuth as auth,
} from "../upstream/server.fixture.ts";
import type { Plan } from "../../../../../stemcells/orchestrator/plan.ts";
import { clearBook } from "./book.ts";
import { ASKI_PATH, COMPILE_BODY_MOST, makeLayer, TEXT_MOST } from "./compileHttp.ts";

// Contract: a message becomes a plan only through the checks. The route answers only a caller
// who may start work, runs each call in a private folder, asks once more with what failed (on
// the stronger model), starts nothing when the compiler is slow or down, and reads a name the
// person confirmed as exact from then on.

interface Lean {
  readonly prompts: string[];
  readonly models: string[];
  answers: Array<Effect.Effect<unknown, unknown>>;
}

const registry = (lean: Lean) =>
  instancesOf((id) =>
    id === "claudeAgent"
      ? {
          enabled: true,
          textGeneration: {
            runLean: (request: {
              readonly cwd: string;
              readonly prompt: string;
              readonly modelSelection: { readonly model: string };
            }) =>
              Effect.suspend(() => {
                expect(NodeFS.existsSync(request.cwd)).toBe(true);
                lean.prompts.push(request.prompt);
                lean.models.push(request.modelSelection.model);
                return lean.answers.shift() ?? Effect.succeed({ acts: [], setup: [], talk: [] });
              }),
          },
        }
      : undefined,
  );

const root = NodeFS.mkdtempSync(NodePath.join(NodeOS.tmpdir(), "stemcells-aski-http-"));
afterAll(() => NodeFS.rmSync(root, { recursive: true, force: true }));
let stateDir = root;
beforeEach(() => {
  stateDir = NodeFS.mkdtempSync(NodePath.join(root, "state-"));
  clearBook();
});

function serve(lean: Lean, first = Duration.seconds(5)) {
  const routes = makeLayer({ first, second: Duration.seconds(5) }).pipe(
    Layer.provideMerge(Layer.mergeAll(auth, registry(lean), configAt(stateDir))),
    Layer.provideMerge(
      HttpPlatform.layer.pipe(
        Layer.provideMerge(NodeServices.layer),
        Layer.provideMerge(Etag.layerWeak),
      ),
    ),
    Layer.provide(NodeServices.layer),
  );
  return HttpRouter.toWebHandler(routes, { disableLogger: true });
}

/** A route's answer, as the plan routes give it. */
const reply = async (response: Promise<Response>) =>
  (await (await response).json()) as { plan: Plan; outcome: unknown };

const lean = (...answers: Array<unknown>): Lean => ({
  prompts: [],
  models: [],
  answers: answers.map((answer) =>
    Effect.isEffect(answer) ? (answer as Lean["answers"][number]) : Effect.succeed(answer),
  ),
});

const send = (
  path: string,
  body: unknown,
  scopes: string | null = AuthOrchestrationOperateScope,
  method = "POST",
) =>
  new Request(`http://127.0.0.1${ASKI_PATH}${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      ...(scopes === null ? {} : { "x-test-scopes": scopes }),
    },
    ...(body === undefined ? {} : { body: typeof body === "string" ? body : JSON.stringify(body) }),
  });

const TEXT = "In Harbor fix the header. In harbour design tidy the tokens";
const asked = (over: Record<string, unknown> = {}) => ({
  id: "plan-0001",
  threadId: "aski-thread",
  text: TEXT,
  context: {
    places: [
      { id: "p-harbor", name: "Harbor" },
      { id: "p-design", name: "Harbor Design" },
    ],
    models: [
      {
        instanceId: "claudeAgent",
        id: "claude-fable-5-1",
        name: "Fable 5.1",
        provider: "claude",
        efforts: ["low", "high"],
        effortOption: "effort",
      },
    ],
    cells: [],
  },
  think: {
    fast: { instanceId: "claudeAgent", model: "claude-haiku-5-5" },
    strong: { instanceId: "claudeAgent", model: "claude-opus-5-5" },
  },
  ...over,
});
const answer = (second = "Harbor Design") => ({
  acts: [
    { kind: "start", pieces: [1], place: "Harbor", placeHeard: "Harbor", title: "Fix the header" },
    { kind: "start", pieces: [2], place: second, placeHeard: "harbour design", title: "Tidy tokens" },
  ],
  setup: [],
  talk: [],
});
const tiers = (plan: Pick<Plan, "acts">) => plan.acts.map((act) => [act.tier, act.why]);

describe("Aski's compile routes", () => {
  it("answer only a caller who may start work", async () => {
    const web = serve(lean(answer()));
    try {
      expect((await web.handler(send("/compile", asked(), null))).status).toBe(401);
      expect(
        (await web.handler(send("/compile", asked(), AuthOrchestrationReadScope))).status,
      ).toBe(403);
      expect((await web.handler(send("/compile", asked()))).status).toBe(200);
    } finally {
      await web.dispose();
    }
  });

  it("make a plan through the checks: an exact project starts, one heard near waits", async () => {
    const calls = lean(answer());
    const web = serve(calls);
    try {
      const { plan } = await reply(web.handler(send("/compile", asked())));
      expect(tiers(plan)).toEqual([
        ["start", []],
        ["check", ["place-near"]],
      ]);
      // Not provably setup, so the words stay as said.
      expect(plan.acts[0]).toMatchObject({ words: "In Harbor fix the header." });
      expect(calls.models).toEqual(["claude-haiku-5-5"]);
      // The compiler reads the person's projects, never a project's files.
      expect(calls.prompts[0]).toContain("- Harbor Design");
    } finally {
      await web.dispose();
    }
  });

  it("ask once more, on the stronger model, with what failed", async () => {
    const calls = lean(answer("Lantern"), answer());
    const web = serve(calls);
    try {
      const { plan } = await reply(web.handler(send("/compile", asked())));
      expect(plan.from).toBe("read");
      expect(calls.models).toEqual(["claude-haiku-5-5", "claude-opus-5-5"]);
      expect(calls.prompts[1]).toContain('"Lantern" is not in Projects');
    } finally {
      await web.dispose();
    }
  });

  it("start nothing when the compiler is slow, with no second wait", async () => {
    const calls = lean(Effect.never);
    const web = serve(calls, Duration.millis(50));
    try {
      const { plan } = await reply(web.handler(send("/compile", asked())));
      expect([plan.from, plan.acts]).toEqual(["floor", []]);
      expect(calls.models).toHaveLength(1);
    } finally {
      await web.dispose();
    }
  });

  it("refuse a request too large to read and a message too long", async () => {
    const web = serve(lean());
    try {
      expect((await web.handler(send("/compile", "x".repeat(COMPILE_BODY_MOST + 1)))).status).toBe(413);
      expect(
        (await web.handler(send("/compile", asked({ text: "x".repeat(TEXT_MOST + 1) })))).status,
      ).toBe(413);
      expect((await web.handler(send("/compile", "{"))).status).toBe(400);
    } finally {
      await web.dispose();
    }
  });

  it("keep what came of a plan, and read a confirmed name exactly from then on", async () => {
    const calls = lean(answer(), answer());
    const web = serve(calls);
    try {
      await web.handler(send("/compile", asked()));
      const told = await web.handler(
        send("/outcome", {
          id: "plan-0001",
          acts: [
            { i: 0, status: "started" },
            { i: 1, status: "started" },
          ],
          learned: { places: [{ heard: "harbour design", name: "Harbor Design" }], models: [] },
        }),
      );
      expect(told.status).toBe(200);
      const kept = await reply(
        web.handler(send("/plan?id=plan-0001", undefined, AuthOrchestrationReadScope, "GET")),
      );
      expect(kept.outcome).toEqual([
        { i: 0, status: "started" },
        { i: 1, status: "started" },
      ]);
      const again = await reply(web.handler(send("/compile", asked({ id: "plan-0002" }))));
      expect(tiers(again.plan)).toEqual([
        ["start", []],
        ["start", []],
      ]);
      expect((await web.handler(send("/learned", undefined, undefined, "DELETE"))).status).toBe(200);
      expect(
        await (
          await web.handler(send("/learned", undefined, AuthOrchestrationReadScope, "GET"))
        ).json(),
      ).toEqual({ places: [], models: [] });
      expect((await web.handler(send("/outcome", { id: "nope", acts: [] }))).status).toBe(404);
    } finally {
      await web.dispose();
    }
  });
});
