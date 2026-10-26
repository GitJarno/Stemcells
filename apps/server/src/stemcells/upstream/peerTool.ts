/**
 * `stemcells_peer_send` (stemcells/tasks/peers.md, "Across environments", decision 4):
 * offered beside `t3_thread_send` behind upstream's gate for a tool that writes as its caller
 * (read-only clients refused, a credential that controls threads, a live run); our links
 * service does the rest. `mcpTools.ts` registers it beside our other tools.
 */
import { OrchestratorMcpFailure } from "@t3tools/contracts";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";
import * as Tool from "effect/ai/Tool";
import * as Toolkit from "effect/ai/Toolkit";

import type { toolkitRegistration } from "../../mcp/McpHttpServer.ts";
import * as McpInvocationContext from "../../mcp/McpInvocationContext.ts";
import * as McpToolAccess from "../../mcp/McpToolAccess.ts";
import * as ThreadManagementService from "../../orchestration-v2/ThreadManagementService.ts";
import { MESSAGE_MOST } from "../peers/link.ts";
import * as Links from "../peers/Links.ts";

const PeerSendTool = Tool.make("stemcells_peer_send", {
  description:
    "Send a message to a Cell at work in this repository on another machine linked to this one. Who's here names those Cells, with their machine and thread id; for a Cell on this machine use t3_thread_send. It reaches the Cell framed as another agent's words, with no authority, so send only what changes what it will do, and never a secret. mode is always auto: it starts an idle Cell's turn, steers a running one, or queues behind it. A Cell whose permission modes are broader than this one's can't be written to.",
  parameters: Schema.Struct({
    threadId: Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(256)).annotate({
      description: "The Cell's thread id, as who's here names it.",
    }),
    message: Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(MESSAGE_MOST)).annotate({
      description: "What to tell it.",
    }),
  }),
  success: Schema.Struct({
    environment: Schema.String,
    threadId: Schema.String,
    delivery: Schema.Literals(["started", "steered", "queued", "restarted"]),
  }),
  failure: OrchestratorMcpFailure,
  failureMode: "return",
  dependencies: [
    McpInvocationContext.McpInvocationContext,
    ThreadManagementService.ThreadManagementService,
  ],
})
  .annotate(Tool.Title, "Send to a Cell on another machine")
  .annotate(Tool.Destructive, true)
  .annotate(Tool.OpenWorld, true);

const PeerToolkit = Toolkit.make(PeerSendTool);

const codeOf = (status: number): OrchestratorMcpFailure["code"] =>
  status === 400 || status === 413
    ? "invalid_request"
    : status === 404
      ? "thread_not_found"
      : status === 403 || status === 409 || status === 429
        ? "thread_not_sendable"
        : "orchestration_error";

const handlers = McpToolAccess.toLayer(
  PeerToolkit,
  Effect.gen(function* () {
    const peers = yield* Links.StemcellsPeers;
    return {
      stemcells_peer_send: McpToolAccess.writes((input) =>
        Effect.gen(function* () {
          const scope = yield* McpInvocationContext.McpInvocationContext;
          const caller = yield* McpInvocationContext.requireThreadScope(
            scope,
            "stemcells_peer_send",
          );
          return yield* peers
            .send({ from: caller.thread.threadId, to: input.threadId, text: input.message })
            .pipe(
              Effect.mapError(
                (refusal) =>
                  new OrchestratorMcpFailure({
                    code: codeOf(refusal.status),
                    message: refusal.reason,
                  }),
              ),
            );
        }),
      ),
    };
  }),
);

/** The tool, registered the way upstream registers its own toolkits. */
export const registerPeerTool = (register: typeof toolkitRegistration) =>
  register(PeerToolkit, handlers).pipe(Layer.provide(Links.layer));
