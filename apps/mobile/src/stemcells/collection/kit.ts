// The collection's rules and words, as the Mac reads them: the catalogue, which feats are new,
// how a piece goes on, and every word either screen shows. Imported here and nowhere else, so
// `cell/hermes.test.ts` reads them for calls the phone lacks.

export {
  actsToShow,
  MOST_TO_DRESS,
  toggled,
} from "../../../../web/src/stemcells/collection/dress.ts";
export {
  type Baseline,
  baselineAfter,
  earnedIds,
  freshFeats,
  rungAbove,
  type Standing,
  standings,
} from "../../../../web/src/stemcells/collection/fresh.ts";
export { type Turns, turns } from "../../../../web/src/stemcells/collection/turns.ts";
export {
  laddersOf,
  type Ladder,
  nextUp,
  rankOf,
  reachOf,
  secretsOf,
  type Tally,
  tallyOf,
} from "../../../../../stemcells/ledger/ladders.ts";
export {
  type Collection,
  type Feat,
  FEAT_ACTS,
  type Rarity,
  SEGMENTS,
  type Today,
  unlockedPieces,
  wornIdOf,
} from "../../../../../stemcells/ledger/feats.ts";
export {
  actWords,
  COLLECTION,
  featName,
  featSaid,
  featTakes,
  ladderName,
  ladderProgress,
  RANK_NAMES,
  RARITY_NAMES,
  rankLine,
  rewardLine,
  rewardShort,
  SECRET,
  SEGMENT_ABOUT,
  SEGMENT_NAMES,
  todayCounts,
} from "../../../../../stemcells/words/feats.ts";
export {
  type Award,
  type CellRecords,
  type MarkId,
  MARKS,
} from "../../../../../stemcells/ledger/marks.ts";
export {
  evidenceOf,
  MARK_NAMES,
  MARK_TAKES,
  marksCount,
  marksOf,
} from "../../../../../stemcells/words/marks.ts";
export {
  MARK_ICON_BOX,
  MARK_ICON_STROKE,
  MARK_ICONS,
} from "../../../../web/src/stemcells/lineage/markIcons.ts";
