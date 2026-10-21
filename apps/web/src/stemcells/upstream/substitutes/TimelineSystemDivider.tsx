// Replaces `components/chat/TimelineSystemDivider.tsx` (`plugin.ts`): the
// divider over a Subcell's thread says what it is, "Subcell of" its parent
// (`stemcells/words/subcells.ts`).
import type { ComponentProps } from "react";

import { TimelineSystemDivider as UpstreamTimelineSystemDivider } from "../../../components/chat/TimelineSystemDivider";
import { inSubcellWords } from "../../../../../../stemcells/words/subcells.ts";

export * from "../../../components/chat/TimelineSystemDivider";

export function TimelineSystemDivider(props: ComponentProps<typeof UpstreamTimelineSystemDivider>) {
  return <UpstreamTimelineSystemDivider {...props} label={inSubcellWords(props.label)} />;
}
