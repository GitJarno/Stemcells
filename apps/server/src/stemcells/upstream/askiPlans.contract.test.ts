/**
 * Aski can't destroy, and proposes instead (stemcells/tasks/aski-orchestrator.md, decision 7),
 * on upstream's own MCP server: a call from Aski's instance to a tool that starts, makes or
 * deletes is refused where every toolkit's handlers pass (`McpToolAccess.toLayer`), and
 * `stemcells_propose` makes a plan in which every Cell waits for the person.
 */
import { expect, it } from "@effect/vitest";
import {
  EnvironmentId,
  OrchestratorMcpFailure,
  ProviderInstanceId,
  ThreadId,
} from "@t3tools/contracts";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";
import { McpSchema, McpServer } from "effect/ai";
import * as Tool from "effect/ai/Tool";
import * as Toolkit from "effect/ai/Toolkit";

import * as McpHttpServer from "../../mcp/McpHttpServer.ts";
import type * as McpInvocationContext from "../../mcp/McpInvocationContext.ts";
import { McpInvocationContext as InvocationContext } from "../../mcp/McpInvocationContext.ts";
import * as McpToolAccess from "../../mcp/McpToolAccess.ts";
import { clearBook, planOfId, settlePlan } from "../aski/book.ts";
import { projectsOf } from "./planner.fixture.ts";
import { agentsDeleteNothing } from "./askiTools.ts";
import { registerPlanTools } from "./planTool.ts";

const environmentId = EnvironmentId.make("environment:aski-plans");
const askis = ProviderInstanceId.make("aski");
const codex = ProviderInstanceId.make("codex");

// Upstream's own tools by name, standing in for them: the guard reads only the name and the caller.
const stand = (name: string, parameters: Schema.Struct<never> = Schema.Struct({ action: Schema.optional(Schema.String) }) as never) =>
  Tool.make(name, {
    description: "Stands in for upstream's tool of this name.",
    parameters,
    success: Schema.Struct({ ran: Schema.Boolean }),
    failure: OrchestratorMcpFailure,
    failureMode: "return",
    dependencies: [InvocationContext],
  });
const Upstreams = Toolkit.make(
  stand("t3_thread_launch"),
  stand("t3_project_delete"),
  stand("t3_thread_organize"),
  stand("t3_thread_list"),
);
const ran = McpToolAccess.reads(() => Effect.succeed({ ran: true }));
const upstreams = McpToolAccess.toLayer(Upstreams, {
  t3_thread_launch: ran,
  t3_project_delete: ran,
  t3_thread_organize: ran,
  t3_thread_list: ran,
});

const layerTest = Layer.mergeAll(
  McpHttpServer.toolkitRegistration(Upstreams, upstreams),
  registerPlanTools(McpHttpServer.toolkitRegistration),
).pipe(
  Layer.provideMerge(McpHttpServer.layerInProcessMcpServer),
  Layer.provide(projectsOf([{ id: "harbor", workspaceRoot: "/projects/harbor", title: "Harbor" } as never])),
);

const client = McpSchema.McpServerClient.of({
  clientId: 1,
  clientCapabilities: {},
  clientInfo: { name: "aski-plans-test", version: "1.0.0" },
  protocolVersion: "2025-06-18",
  initializePayload: {
    protocolVersion: "2025-06-18",
    capabilities: {},
    clientInfo: { name: "aski-plans-test", version: "1.0.0" },
  },
  getClient: Effect.die("unused"),
});

const from = (
  providerInstanceId: ProviderInstanceId,
  subagent = false,
): McpInvocationContext.McpInvocationScope => ({
  environmentId,
  requestNamespace: `session:${providerInstanceId}`,
  thread: {
    threadId: ThreadId.make(`thread:${providerInstanceId}`),
    providerSessionId: `session:${providerInstanceId}`,
    providerInstanceId,
    ...(subagent ? { subagent } : {}),
  },
  client: undefined,
  capabilities: new Set(["orchestration"]),
  issuedAt: 1,
});

/** What tool `name` answers `caller`: its result, or the refusal's words. */
const call = (
  caller: McpInvocationContext.McpInvocationScope,
  name: string,
  input: Record<string, unknown> = {},
) =>
  Effect.gen(function* () {
    const server = yield* McpServer.McpServer;
    const result = yield* server
      .callTool({ name, arguments: input })
      .pipe(
        Effect.provideService(InvocationContext, caller),
        Effect.provideService(McpSchema.McpServerClient, client),
      );
    if (!result.isError) return { ok: result.structuredContent as Record<string, unknown> };
    const [first] = result.content;
    return { refused: first?.type === "text" ? first.text : "" };
  });

it.layer(layerTest)("Aski's chat and plans", (it) => {
  it.effect("refuses Aski's instance every tool that starts, makes or deletes, and no one else", () =>
    Effect.gen(function* () {
      for (const name of ["t3_thread_launch", "t3_project_delete"]) {
        expect(yield* call(from(askis), name)).toMatchObject({
          refused: expect.stringContaining("Aski's chat"),
        });
        // A helper Aski started runs on Aski's instance too.
        expect(yield* call(from(askis, true), name)).toHaveProperty("refused");
        expect(yield* call(from(codex), name)).toEqual({ ok: { ran: true } });
      }
      // Putting a Cell to sleep is Aski's to do; archiving one is a deletion.
      expect(yield* call(from(askis), "t3_thread_organize", { action: "settle" })).toEqual({
        ok: { ran: true },
      });
      expect(yield* call(from(askis), "t3_thread_organize", { action: "archive" })).toHaveProperty(
        "refused",
      );
      expect(yield* call(from(askis), "t3_thread_list")).toEqual({ ok: { ran: true } });
    }),
  );

  it.effect("lets no agent delete a project while Stemcells' server stands", () =>
    Effect.scoped(
      Effect.gen(function* () {
        yield* agentsDeleteNothing;
        expect(yield* call(from(codex), "t3_project_delete")).toMatchObject({
          refused: expect.stringContaining("No Cell deletes a project"),
        });
        // A Cell still starts Cells and reads: only the deletion is the person's.
        expect(yield* call(from(codex), "t3_thread_launch")).toEqual({ ok: { ran: true } });
        expect(yield* call(from(codex), "t3_thread_list")).toEqual({ ok: { ran: true } });
      }),
    ),
  );

  it.effect("makes a proposed plan in which every Cell waits for the person", () =>
    Effect.gen(function* () {
      clearBook();
      const cells = [{ projectId: "harbor", title: "Fix the header", message: "Fix the header." }];
      expect(yield* call(from(codex), "stemcells_propose", { cells })).toHaveProperty("refused");
      expect(yield* call(from(askis, true), "stemcells_propose", { cells })).toHaveProperty(
        "refused",
      );
      expect(
        yield* call(from(askis), "stemcells_propose", {
          cells: [{ ...cells[0], projectId: "lantern" }],
        }),
      ).toMatchObject({ refused: expect.stringContaining("No project lantern") });
      expect(
        yield* call(from(askis), "stemcells_propose", {
          cells: [{ ...cells[0], modelSelection: { instanceId: "aski", model: "claude-opus-5-5" } }],
        }),
      ).toMatchObject({ refused: expect.stringContaining("Aski's own") });

      const made = yield* call(from(askis), "stemcells_propose", { cells });
      const planId = (made.ok as { readonly planId: string }).planId;
      expect(made.ok).toMatchObject({ show: `\`\`\`plan\n${planId}\n\`\`\`` });
      const entry = planOfId(planId)!;
      expect(entry.plan.acts).toMatchObject([
        {
          kind: "start",
          tier: "check",
          why: ["proposed"],
          words: "Fix the header.",
          place: { projectId: "harbor", name: "Harbor" },
        },
      ]);

      // What came of it reads back once the client has said.
      settlePlan(planId, [{ i: 0, status: "started" }]);
      const read = yield* call(from(askis), "stemcells_plan", { id: planId });
      expect((read.ok as { readonly report: string }).report).toMatch(
        /^- Started: \[\w+: Fix the header\]\(t3-thread:\/\/v1\/[\w-]+\) in Harbor\.$/,
      );
      expect(yield* call(from(codex), "stemcells_plan", { id: planId })).toHaveProperty("refused");
    }),
  );
});
