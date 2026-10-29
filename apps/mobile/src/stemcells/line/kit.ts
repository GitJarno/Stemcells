// The Cells' line and its asks: the web's own plain TypeScript, imported here and nowhere
// else, as the creature is (`cell/kit.ts`). What a card says and offers, the commands a choice
// sends, the line's stages and the filter's words are the Mac's, so the two never disagree.

export {
  type CellStanding,
  type Need,
  type NeedKind,
  type NeedsList,
  needsListOf,
} from "../../../../web/src/stemcells/needs/wire.ts";
export {
  cardOf,
  LATER,
  NOTHING_TO_DO,
  type Card,
  type CardOption,
  type CardQuestion,
} from "../../../../web/src/stemcells/needs/card.ts";
export {
  repositoryUrlOf,
  sentenceCase,
  spansOf,
  type Span,
} from "../../../../web/src/stemcells/needs/inline.ts";
export {
  commandsFor,
  type Given,
  type ThreadCommand,
} from "../../../../web/src/stemcells/needs/actions.ts";
export { movedByHand, takeMovedByHand } from "../../../../web/src/stemcells/needs/byHand.ts";
export {
  hopsOf,
  standingsOf,
  type Hop,
  type LineStage,
  type Standings,
} from "../../../../web/src/stemcells/rail/moves.ts";
export {
  elsewhereWords,
  shows,
  type Elsewhere,
  type FilterProject,
} from "../../../../web/src/stemcells/rail/filter.ts";
