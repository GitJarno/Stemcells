// The welcome's agents step shows Claude Code, not Aski: Aski's provider
// instance runs on Claude's driver, and upstream shows one instance a driver.
import { ProviderDriverKind, ProviderInstanceId, type ServerProvider } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import { ASKI_INSTANCE_ID } from "../../aski/setup";
import { selectOnboardingProvidersByDriver } from "./providerReadiness.logic";

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
  it("show Claude's own instance for Claude, never Aski's", () => {
    const byDriver = selectOnboardingProvidersByDriver([
      ready(ASKI_INSTANCE_ID),
      ready("claudeAgent"),
    ]);
    expect(byDriver.get("claudeAgent")?.instanceId).toBe("claudeAgent");
    expect(selectOnboardingProvidersByDriver([ready(ASKI_INSTANCE_ID)]).has("claudeAgent")).toBe(
      false,
    );
  });
});
