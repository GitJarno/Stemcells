// Replaces `onboarding/providerReadiness.logic.ts` (`plugin.ts`): the
// welcome's agents step shows Claude Code, not Aski. Aski's provider
// instance runs on Claude's driver (`stemcells/aski/setup.ts`), and the step
// shows one instance a driver, so Aski's could stand in Claude's place,
// "Aski, Ready to code", and Claude's own go unlisted.
import { selectOnboardingProvidersByDriver as selectUpstream } from "../../../onboarding/providerReadiness.logic";
import { isAskisInstance } from "../../aski/setup";

export * from "../../../onboarding/providerReadiness.logic";

export function selectOnboardingProvidersByDriver(
  providers: Parameters<typeof selectUpstream>[0],
): ReturnType<typeof selectUpstream> {
  return selectUpstream(providers?.filter((provider) => !isAskisInstance(provider.instanceId)));
}
