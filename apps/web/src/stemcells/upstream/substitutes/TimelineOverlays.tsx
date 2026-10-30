// Replaces `components/chat/TimelineOverlays.tsx` (`plugin.ts`): the button
// back to a chat's end says Subcell where the chat's summary says subagent
// ("Subcell waiting · 2 queued"; `stemcells/words/subcells.ts`).
import type { ComponentProps } from "react";

import { ScrollToEndButton as UpstreamScrollToEndButton } from "../../../components/chat/TimelineOverlays";
import { inSubcellWords } from "../../../../../../stemcells/words/subcells.ts";

export * from "../../../components/chat/TimelineOverlays";

export function ScrollToEndButton(props: ComponentProps<typeof UpstreamScrollToEndButton>) {
  return (
    <UpstreamScrollToEndButton
      {...props}
      summary={props.summary === null ? null : inSubcellWords(props.summary)}
    />
  );
}
