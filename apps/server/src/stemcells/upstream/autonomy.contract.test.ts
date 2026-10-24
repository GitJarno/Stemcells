// @effect-diagnostics nodeBuiltinImport:off - reads the words the web app sends from its source.
import * as NodeFS from "node:fs";
import * as NodePath from "node:path";
import * as NodeURL from "node:url";

import { OrchestrationV2Command } from "@t3tools/contracts";
import * as Schema from "effect/Schema";
import { describe, expect, it } from "vite-plus/test";

import { BOUNDARY, PHRASES, PLAN_PREFIX } from "../autonomy/kinds.ts";
import type { Need } from "../needs/derive.ts";
import { TAKE_PREFIX, takeCommands } from "./autonomy.ts";

const web = NodePath.resolve(
  NodePath.dirname(NodeURL.fileURLToPath(import.meta.url)),
  "../../../../web/src",
);
const read = (file: string) => NodeFS.readFileSync(NodePath.join(web, file), "utf8");

const decode = Schema.decodeUnknownSync(OrchestrationV2Command);

const planNeed: Need = {
  key: "thread-1:plan:run-1",
  number: 1,
  kind: "plan",
  threadId: "thread-1",
  projectId: "project-1",
  parentThreadId: null,
  title: "A Cell",
  providerInstanceId: "claudeAgent",
  since: "2026-10-24T12:00:00.000Z",
  blocks: false,
  request: null,
  plan: { id: "plan-1", runId: "run-1", title: "Tidy", steps: [], markdown: "# Tidy\n- Sort it\n" },
  limit: null,
  failure: null,
  prose: null,
  stuck: null,
};

describe("a take, as upstream's orchestrator reads it", () => {
  it("a plan's take is upstream's Implement: out of plan mode, then the plan to build", () => {
    const commands = takeCommands(planNeed, "implement").map((command) => decode(command));
    expect(commands.map((command) => command.type)).toEqual([
      "thread.interaction-mode.set",
      "message.dispatch",
    ]);
    const [mode, message] = commands;
    expect(mode).toMatchObject({ interactionMode: "default" });
    expect(message).toMatchObject({
      commandId: `${TAKE_PREFIX}${planNeed.key}`,
      text: `${PLAN_PREFIX}# Tidy\n- Sort it\n\n${BOUNDARY}`,
      sourcePlanRef: { threadId: "thread-1", planId: "plan-1" },
      dispatchMode: { type: "start_immediately" },
    });
  });

  it("a message's take sends the card's own words and the boundary, under the card's key", () => {
    const [message] = takeCommands({ ...planNeed, kind: "failed", plan: null }, "retry").map(
      (command) => decode(command),
    );
    expect(message).toMatchObject({
      type: "message.dispatch",
      commandId: `${TAKE_PREFIX}${planNeed.key}`,
      text: `${PHRASES.retry} ${BOUNDARY}`,
    });
  });
});

// A take is counted when the person's message is the card's own words: the
// room's options and upstream's Implement must send what autonomy reads.
describe("the words the screens send", () => {
  it("are the words autonomy counts", () => {
    const card = read("stemcells/needs/card.ts");
    expect(card).toContain(`retry: "${PHRASES.retry}"`);
    expect(card).toContain(`goAhead: "${PHRASES.goAhead}"`);
    expect(read("proposedPlan.ts")).toContain(
      `PLAN_IMPLEMENTATION_PROMPT_PREFIX = ${JSON.stringify(PLAN_PREFIX)}`,
    );
  });
});
