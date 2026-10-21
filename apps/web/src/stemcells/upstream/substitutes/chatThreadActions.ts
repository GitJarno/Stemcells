// Replaces `lib/chatThreadActions.ts` (`plugin.ts`): a new chat never starts
// on Aski's provider instance. Upstream's new chat carries the model of the
// chat on screen, so one opened from Aski's chat (its tab's +, ⌘T there, the
// sidebar's new chat) ran on Aski's instance, with Aski's persona. A model
// carried from any other chat is upstream's.
import { resolveNewThreadModelSelectionOverride as resolveUpstreamOverride } from "../../../lib/chatThreadActions";
import { isAskisInstance } from "../../aski/setup";

export * from "../../../lib/chatThreadActions";

export function resolveNewThreadModelSelectionOverride(
  input: Parameters<typeof resolveUpstreamOverride>[0],
): ReturnType<typeof resolveUpstreamOverride> {
  const carriesAskis = isAskisInstance(input.carrySelection?.instanceId);
  return resolveUpstreamOverride(carriesAskis ? { ...input, carrySelection: null } : input);
}
