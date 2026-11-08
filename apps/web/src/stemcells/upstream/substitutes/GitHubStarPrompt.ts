// Replaces `components/GitHubStarPrompt.tsx` (`plugin.ts`): Stemcells never asks for a star.
// Upstream's asks GitHub, through the person's account, whether they starred T3's repository,
// then offers to star it in one click under a title the build renames to Stemcells (seams.md,
// No telemetry).
import type * as Upstream from "../../../components/GitHubStarPrompt";

export const recordPromptSent: typeof Upstream.recordPromptSent = () => Promise.resolve();
