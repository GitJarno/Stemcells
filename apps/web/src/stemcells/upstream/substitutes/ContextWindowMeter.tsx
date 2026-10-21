// Replaces `components/chat/ContextWindowMeter.tsx` (`plugin.ts`): the meter
// fills toward where the chat compacts, not toward the whole window.
import type { ComponentProps } from "react";

import { ContextWindowMeter as UpstreamContextWindowMeter } from "../../../components/chat/ContextWindowMeter";
import { towardCompaction } from "../../compaction/meter";

export * from "../../../components/chat/ContextWindowMeter";

export function ContextWindowMeter(props: ComponentProps<typeof UpstreamContextWindowMeter>) {
  return <UpstreamContextWindowMeter {...props} usage={towardCompaction(props.usage)} />;
}
