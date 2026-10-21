/**
 * Upstream behaviour the web relies on to move a Cell's chat off Aski's
 * instance at its next send, with no error to show
 * (`apps/web/src/stemcells/upstream/cellInstance.ts`): a turn sent on the
 * driver's own instance carries the chat over, resumed in place when Aski's
 * instance shares the driver's home, else handed off, and nothing refuses it
 * while that instance is up. A failure here after a sync means a chat left on
 * Aski's instance needs a way to move that the composer offers.
 */
import {
  type OrchestrationV2ProviderCapabilities,
  ProviderDriverKind,
  ProviderInstanceId,
} from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import { decideProviderSessionTransition } from "../../orchestration-v2/ProviderSessionTransitionPolicy.ts";

const claude = ProviderDriverKind.make("claudeAgent");
const capabilities = {} as OrchestrationV2ProviderCapabilities;

function move(homes: { readonly askis: string; readonly cell: string }) {
  const side = (instanceId: string, home: string) => ({
    driver: claude,
    continuationIdentity: { driverKind: claude, continuationKey: home },
    modelSelection: { instanceId: ProviderInstanceId.make(instanceId), model: "model-a" },
    runtimeMode: "full-access" as const,
    interactionMode: "default" as const,
    workspace: "/projects/example",
    capabilities,
  });
  return decideProviderSessionTransition({
    current: side("aski", homes.askis),
    target: { ...side("claudeAgent", homes.cell), available: true },
  }).type;
}

describe("a Cell's chat sent from Aski's instance to its driver's own", () => {
  it("resumes in place when they share a home, as Aski's instance does", () => {
    expect(move({ askis: "claude:home", cell: "claude:home" })).toBe("restart_and_resume");
  });

  it("is handed off when they don't, and is never refused", () => {
    expect(move({ askis: "claude:aski", cell: "claude:home" })).toBe("create_with_handoff");
  });
});
