// Replaces `onboarding/welcomePage.logic.ts` (`plugin.ts`): the welcome's agents list Claude Code,
// not Aski. Aski's instance runs on Claude's driver (`stemcells/aski/setup.ts`), so it would read
// "Aski, Ready" beside the agents a person set up.
import { groupWelcomeAgents as groupUpstream } from "../../../onboarding/welcomePage.logic";
import { isAskisInstance } from "../../aski/setup";

export * from "../../../onboarding/welcomePage.logic";

export function groupWelcomeAgents(
  providers: Parameters<typeof groupUpstream>[0],
  ...rest: Parameters<typeof groupUpstream> extends [unknown, ...infer Rest] ? Rest : never
): ReturnType<typeof groupUpstream> {
  return groupUpstream(
    providers?.filter((provider) => !isAskisInstance(provider.instanceId)),
    ...rest,
  );
}
