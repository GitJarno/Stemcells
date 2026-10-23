// Replaces `components/chat/DraftHeroProjectHeading.tsx` (`plugin.ts`): when
// a new chat's words start Cells in several places, the hero names them,
// "What should we build in Harbor and Atlas?", or "Harbor and 2 more" past
// two (`stemcells/words/heroPlaces.ts`). The draft's own project stays its
// picker: the draft is the first Cell.
import { type ComponentProps, type ReactNode, use } from "react";

import { DraftHeroProjectHeading as UpstreamHeading } from "../../../components/chat/DraftHeroProjectHeading";
import { PaneCellContext } from "../../tabs/paneCell";
import { useShownPlaces } from "../../words/heroPlaces";

export * from "../../../components/chat/DraftHeroProjectHeading";

export function DraftHeroProjectHeading(props: ComponentProps<typeof UpstreamHeading>): ReactNode {
  const places = useShownPlaces(use(PaneCellContext)?.draftId ?? null);
  if (places === null) return <UpstreamHeading {...props} />;
  // Its project is one of them, unless its word is still at the caret.
  const own = places.includes(props.projectName);
  const others = own ? places.filter((place) => place !== props.projectName) : places.slice(1);
  const rest = others.length === 1 ? others[0]! : `${others.length} more`;
  const first = own ? props.projectName : places[0]!;
  return (
    <UpstreamHeading projectName={`${first} and ${rest}`}>
      {own ? props.children : <span data-stemcells-hero-place="">{first}</span>}
      <span className="whitespace-pre"> and </span>
      <span data-stemcells-hero-place="">{rest}</span>
    </UpstreamHeading>
  );
}
