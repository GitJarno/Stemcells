import { expect, it } from "@effect/vitest";
import { EnvironmentId, ProviderInstanceId, ThreadId } from "@t3tools/contracts";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { McpSchema, McpServer } from "effect/ai";

import * as McpHttpServer from "../../mcp/McpHttpServer.ts";
import * as McpInvocationContext from "../../mcp/McpInvocationContext.ts";
import * as McpToolAccessTestkit from "../../mcp/McpToolAccess.testkit.ts";
import * as StemcellsDrives from "../disk/StemcellsDrives.ts";
import * as StemcellsMoves from "../disk/StemcellsMoves.ts";
import { moveToolsOn } from "./diskMoveTool.ts";

// Contract: a Cell reaches Settings › Disk's moves through upstream's MCP server, registered as
// upstream registers its toolkits; a drive is named as the person sees it, and a refusal comes
// back with the reason the page would show.

const invocation = {
  environmentId: EnvironmentId.make("environment-moves-test"),
  requestNamespace: "provider-session-moves-test",
  thread: {
    threadId: ThreadId.make("thread-moves-test"),
    providerSessionId: "provider-session-moves-test",
    providerInstanceId: ProviderInstanceId.make("codex"),
  },
  client: undefined,
  capabilities: new Set(["orchestration"] as const),
  issuedAt: 1,
};
const client = McpSchema.McpServerClient.of({
  clientId: 1,
  clientCapabilities: {},
  clientInfo: { name: "moves-test", version: "1.0.0" },
  protocolVersion: "2025-06-18",
  initializePayload: {
    protocolVersion: "2025-06-18",
    capabilities: {},
    clientInfo: { name: "moves-test", version: "1.0.0" },
  },
  getClient: Effect.die("unused"),
});

const spare: StemcellsDrives.Drive = {
  id: "00000000-0000-4000-8000-00000000000D",
  name: "Spare",
  role: "external",
  total: 1e12,
  free: 9e11,
  detail: null,
  lookInside: false,
  canLookInside: true,
};
const startup: StemcellsDrives.Drive = { ...spare, id: "startup", name: "Mac", role: "startup" };

const machine = (calls: Array<string>, refuse: boolean) =>
  moveToolsOn(McpHttpServer.toolkitRegistration).pipe(
    Layer.provideMerge(McpHttpServer.layerInProcessMcpServer),
    Layer.provideMerge(McpToolAccessTestkit.liveThreadsLayer),
    Layer.provide(
      Layer.mergeAll(
        Layer.mock(StemcellsDrives.StemcellsDrives)({
          list: () => Effect.succeed([startup, spare]),
        }),
        Layer.mock(StemcellsMoves.StemcellsMoves)({
          status: () =>
            Effect.succeed({
              places: [{ kind: "simulators", where: "here", bytes: 16e9 }],
              job: null,
              last: null,
            }),
          moveAway: ({ kind, driveId }) =>
            refuse
              ? Effect.fail(new StemcellsMoves.MoveError({ reason: "A simulator is running." }))
              : Effect.sync(() => void calls.push(`away ${kind} ${driveId}`)),
          moveBack: (kind) => Effect.sync(() => void calls.push(`back ${kind}`)),
        }),
      ),
    ),
  );

const call = (name: string, args: Record<string, string>) =>
  Effect.gen(function* () {
    const server = yield* McpServer.McpServer;
    return yield* server
      .callTool({ name, arguments: args })
      .pipe(
        Effect.provideService(McpInvocationContext.McpInvocationContext, invocation),
        Effect.provideService(McpSchema.McpServerClient, client),
      );
  });

const text = (result: { readonly content: ReadonlyArray<unknown> }) =>
  JSON.stringify(result.content);

it.effect("a Cell reads where things are and moves one to a drive it names, and back", () => {
  const calls: Array<string> = [];
  return Effect.gen(function* () {
    const read = yield* call("stemcells_disk_moves", {});
    expect(read.isError).toBe(false);
    expect(text(read)).toContain("simulators (Simulators): on this Mac");
    expect(text(read)).toContain(`Spare (id ${spare.id}`);
    expect(text(read)).not.toContain("Mac (id startup");

    expect((yield* call("stemcells_disk_move", { kind: "simulators", to: "Spare" })).isError).toBe(
      false,
    );
    expect((yield* call("stemcells_disk_move", { kind: "simulators", to: "back" })).isError).toBe(
      false,
    );
    const startupDisk = yield* call("stemcells_disk_move", { kind: "simulators", to: "Mac" });
    expect(startupDisk.isError).toBe(true);
    expect(calls).toEqual([`away simulators ${spare.id}`, "back simulators"]);
  }).pipe(Effect.provide(machine(calls, false)));
});

it.effect("a refusal comes back with the page's reason, and nothing moves", () => {
  const calls: Array<string> = [];
  return Effect.gen(function* () {
    const refused = yield* call("stemcells_disk_move", { kind: "simulators", to: spare.id });
    expect(refused.isError).toBe(true);
    expect(text(refused)).toContain("A simulator is running.");
    expect(calls).toEqual([]);
  }).pipe(Effect.provide(machine(calls, true)));
});
