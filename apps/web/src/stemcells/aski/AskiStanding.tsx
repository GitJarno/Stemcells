import { AskiFigure } from "./AskiFigure";
import { useStandingLeft } from "./standing";

import "./aski.css";

/**
 * Aski over a new chat's headline (stemcells/tasks/aski-manager.md,
 * decision 4), standing where the spawn's Aski stands: what's written
 * here, Aski carries into Cells. Its eyes follow the chat's caret. It
 * leaves as the words go (`standing.ts`).
 */
export function AskiStanding(props: { draftId: string | null }) {
  const left = useStandingLeft(props.draftId);
  return (
    <div data-stemcells-aski-standing="" data-left={left ? "" : undefined}>
      <AskiFigure field='[data-chat-composer-stack="true"]' />
    </div>
  );
}
