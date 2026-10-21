// @effect-diagnostics nodeBuiltinImport:off - makes the project folders the lines are read from.
import * as NodeFS from "node:fs";
import * as NodeOS from "node:os";
import * as NodePath from "node:path";

import * as NodeServices from "@effect/platform-node/NodeServices";
import { AuthOrchestrationOperateScope, AuthOrchestrationReadScope } from "@t3tools/contracts";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { HttpRouter } from "effect/http";
import * as Etag from "effect/http/Etag";
import * as HttpPlatform from "effect/http/HttpPlatform";
import { afterAll, describe, expect, it } from "vite-plus/test";

import * as EnvironmentAuth from "../../auth/EnvironmentAuth.ts";
import * as ServerConfig from "../../config.ts";
import * as ProjectStore from "../../orchestration-v2/ProjectStore.ts";
import * as ProviderInstanceRegistry from "../../provider/ProviderInstanceRegistry.ts";
import { makeLayer, PLAN_BODY_MOST, PLAN_RECORD_MOST, PLANNER_PATH, PROMPT_MOST } from "./http.ts";

// Contract: the planner's routes answer only callers with their scope, read
// no more than they take, stop a call at its time, run each call in a
// private folder, read a project's line only inside the project, and keep
// the plan history only in the app's own state folder, which they clear.

/** A caller's scopes ride a test header; none is no credential. */
const auth = Layer.succeed(EnvironmentAuth.EnvironmentAuth, {
  authenticateHttpRequest: (request: { readonly headers: Record<string, string | undefined> }) => {
    const scopes = request.headers["x-test-scopes"];
    return scopes === undefined
      ? Effect.fail(new EnvironmentAuth.ServerAuthMissingCredentialError())
      : Effect.succeed({
          sessionId: "session",
          subject: "test",
          method: "browser-session-cookie",
          scopes: scopes.split(",").filter(Boolean),
        });
  },
} as never);

interface Lean {
  readonly cwds: string[];
  interrupted: boolean;
  answer: Effect.Effect<unknown>;
}

const registry = (lean: Lean) =>
  Layer.succeed(ProviderInstanceRegistry.ProviderInstanceRegistry, {
    getInstance: (id: string) =>
      Effect.succeed(
        id === "claudeAgent"
          ? {
              enabled: true,
              textGeneration: {
                runLean: (request: { readonly cwd: string }) =>
                  Effect.suspend(() => {
                    lean.cwds.push(request.cwd);
                    expect(NodeFS.existsSync(request.cwd)).toBe(true);
                    return lean.answer;
                  }).pipe(
                    Effect.onInterrupt(() =>
                      Effect.sync(() => {
                        lean.interrupted = true;
                      }),
                    ),
                  ),
              },
            }
          : undefined,
      ),
  } as never);

const root = NodeFS.mkdtempSync(NodePath.join(NodeOS.tmpdir(), "stemcells-planner-http-"));
afterAll(() => NodeFS.rmSync(root, { recursive: true, force: true }));
const project = NodePath.join(root, "Harbor");
const outside = NodePath.join(root, "outside.md");
NodeFS.mkdirSync(project);
NodeFS.writeFileSync(outside, "# Secret\n\nA line from outside the project.\n");
NodeFS.symlinkSync(outside, NodePath.join(project, "AGENTS.md"));
NodeFS.writeFileSync(NodePath.join(project, "README.md"), "# Harbor\n\nThe ferry timetable.\n");

const projects = Layer.succeed(ProjectStore.ProjectStoreV2, {
  listShells: (options?: { readonly projectIds?: ReadonlyArray<string> }) =>
    Effect.succeed(
      [{ id: "harbor", workspaceRoot: project }].filter(
        (shell) => options?.projectIds?.includes(shell.id) ?? true,
      ),
    ),
} as never);

/** The app's state folder, where the plan history lives. */
const stateDir = NodePath.join(root, "state");
const config = Layer.succeed(ServerConfig.ServerConfig, { stateDir } as never);

function serve(lean: Lean, planTime = Duration.seconds(5)) {
  const routes = makeLayer(planTime).pipe(
    Layer.provideMerge(Layer.mergeAll(auth, registry(lean), projects, config)),
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

const lean = (answer: Effect.Effect<unknown> = Effect.succeed({ cells: [] })): Lean => ({
  cwds: [],
  interrupted: false,
  answer,
});

const plan = (body: string, scopes: string | null = AuthOrchestrationOperateScope) =>
  new Request(`http://127.0.0.1${PLANNER_PATH}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(scopes === null ? {} : { "x-test-scopes": scopes }),
    },
    body,
  });

const asked = (prompt = "Plan these Cells.", options: unknown[] = []) =>
  JSON.stringify({
    prompt,
    modelSelection: { instanceId: "claudeAgent", model: "claude-opus-5-5", options },
  });

describe("the planner's routes", () => {
  it("answer a plan only to a caller who may start work, and lines to one who may read", async () => {
    const web = serve(lean());
    try {
      expect((await web.handler(plan(asked(), null))).status).toBe(401);
      expect((await web.handler(plan(asked(), AuthOrchestrationReadScope))).status).toBe(403);
      const answered = await web.handler(plan(asked()));
      expect(answered.status).toBe(200);
      expect(await answered.json()).toMatchObject({ ok: true, answer: { cells: [] } });
      const lines = (scopes: string | null) =>
        web.handler(
          new Request(`http://127.0.0.1${PLANNER_PATH}/lines?project=harbor`, {
            headers: scopes === null ? {} : { "x-test-scopes": scopes },
          }),
        );
      expect((await lines(null)).status).toBe(401);
      expect((await lines(AuthOrchestrationReadScope)).status).toBe(200);
    } finally {
      await web.dispose();
    }
  });

  it("refuse a request too large to read, a prompt too long, and models with too many options", async () => {
    const web = serve(lean());
    try {
      expect((await web.handler(plan("x".repeat(PLAN_BODY_MOST + 1)))).status).toBe(413);
      expect((await web.handler(plan(asked("x".repeat(PROMPT_MOST + 1))))).status).toBe(413);
      const many = Array.from({ length: 9 }, (_, i) => ({ id: `option${i}`, value: "low" }));
      expect((await web.handler(plan(asked("Plan.", many)))).status).toBe(400);
      expect((await web.handler(plan("{"))).status).toBe(400);
    } finally {
      await web.dispose();
    }
  });

  it("stop a call at its time, and say so", async () => {
    const slow = lean(Effect.never);
    const web = serve(slow, Duration.millis(50));
    try {
      const reply = await web.handler(plan(asked()));
      expect(await reply.json()).toMatchObject({ ok: false, reason: "timeout" });
      expect(slow.interrupted).toBe(true);
    } finally {
      await web.dispose();
    }
  });

  it("run each call in a private folder of its own, gone after", async () => {
    const calls = lean();
    const web = serve(calls);
    try {
      await web.handler(plan(asked()));
      await web.handler(plan(asked()));
      expect(new Set(calls.cwds).size).toBe(2);
      for (const cwd of calls.cwds) expect(NodeFS.existsSync(cwd)).toBe(false);
    } finally {
      await web.dispose();
    }
  });

  it("read a project's line only inside the project, and skip an id that isn't one", async () => {
    const web = serve(lean());
    try {
      const reply = await web.handler(
        new Request(
          `http://127.0.0.1${PLANNER_PATH}/lines?project=harbor&project=&project=%20harbor%20`,
          { headers: { "x-test-scopes": AuthOrchestrationReadScope } },
        ),
      );
      expect(reply.status).toBe(200);
      // AGENTS.md links outside the project, so the README's line is read.
      expect(await reply.json()).toEqual({ lines: { harbor: "The ferry timetable." } });
    } finally {
      await web.dispose();
    }
  });

  it("keep the plan history in the app's state folder, refuse a record too large, and forget it", async () => {
    const web = serve(lean());
    const history = (
      method: string,
      body?: string,
      scopes: string = AuthOrchestrationOperateScope,
    ) =>
      web.handler(
        new Request(`http://127.0.0.1${PLANNER_PATH}/history`, {
          method,
          headers: { "content-type": "application/json", "x-test-scopes": scopes },
          ...(body === undefined ? {} : { body }),
        }),
      );
    const plans = NodePath.join(stateDir, "stemcells", "plans");
    try {
      expect((await history("POST", JSON.stringify({ words: "fix it" }))).status).toBe(200);
      expect(NodeFS.readdirSync(plans)).toHaveLength(1);
      const tooLarge = JSON.stringify({ words: "x".repeat(PLAN_RECORD_MOST) });
      expect((await history("POST", tooLarge)).status).toBe(413);
      expect((await history("POST", "[1]")).status).toBe(400);
      expect((await history("DELETE", undefined, AuthOrchestrationReadScope)).status).toBe(403);
      expect((await history("DELETE")).status).toBe(200);
      expect(NodeFS.existsSync(plans)).toBe(false);
    } finally {
      await web.dispose();
    }
  });
});
