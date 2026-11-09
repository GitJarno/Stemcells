// The welcome lists Claude Code among the agents, not Aski, whose provider instance runs on
// Claude's driver.
import { ProviderDriverKind, ProviderInstanceId, type ServerProvider } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import { ASKI_INSTANCE_ID } from "../../aski/setup";
import { groupWelcomeAgents } from "./welcomePage.logic";

const ready = (instanceId: string): ServerProvider => ({
  instanceId: ProviderInstanceId.make(instanceId),
  driver: ProviderDriverKind.make("claudeAgent"),
  displayName: instanceId === ASKI_INSTANCE_ID ? "Aski" : undefined,
  enabled: true,
  installed: true,
  version: "1.0.0",
  status: "ready",
  auth: { status: "authenticated" },
  checkedAt: "2026-10-23T00:00:00.000Z",
  models: [],
  slashCommands: [],
  skills: [],
});

describe("the welcome's agents", () => {
  it("count and list Claude's own instance, never Aski's", () => {
    const groups = groupWelcomeAgents(
      [ready(ASKI_INSTANCE_ID), ready("claudeAgent")],
      undefined,
      (provider) => provider.instanceId,
      () => true,
    );
    expect(groups.found.map((provider) => provider.instanceId)).toEqual(["claudeAgent"]);
    expect(groups.readyCount).toBe(1);
  });
});
