// Replaces `components/chat/DraftHeroHeadline.tsx` (`plugin.ts`): Aski
// stands over every new chat's headline (`stemcells/aski/AskiStanding.tsx`),
// in a project or in none, so a new tab is plainly Aski's.
import { type ComponentProps, use } from "react";

import { DraftHeroHeadline as UpstreamHeadline } from "../../../components/chat/DraftHeroHeadline";
import { AskiStanding } from "../../aski/AskiStanding";
import { PaneCellContext } from "../../tabs/paneCell";

export * from "../../../components/chat/DraftHeroHeadline";

export function DraftHeroHeadline(props: ComponentProps<typeof UpstreamHeadline>) {
  const draftId = use(PaneCellContext)?.draftId ?? null;
  return (
    <div className="relative w-full">
      <AskiStanding draftId={draftId} />
      <UpstreamHeadline {...props} />
    </div>
  );
}
