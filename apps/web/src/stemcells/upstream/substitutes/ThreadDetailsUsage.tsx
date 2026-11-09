// Replaces `components/chat/ThreadDetailsUsage.tsx` (`plugin.ts`): the context bar fills toward
// where the chat compacts (`compaction/meter.ts`), not toward the model's whole context.
import type { ComponentProps } from "react";

import { ThreadDetailsContext as UpstreamThreadDetailsContext } from "../../../components/chat/ThreadDetailsUsage";
import { towardCompaction } from "../../compaction/meter";

export * from "../../../components/chat/ThreadDetailsUsage";

export function ThreadDetailsContext(props: ComponentProps<typeof UpstreamThreadDetailsContext>) {
  return <UpstreamThreadDetailsContext usage={towardCompaction(props.usage)} />;
}
