// The collection's rules and words, as the Mac reads them: the catalogue, which feats are new,
// how a piece goes on, and every word either screen shows. Imported here and nowhere else, so
// `cell/hermes.test.ts` reads them for calls the phone lacks.

export {
  actsToShow,
  MOST_TO_DRESS,
  toggled,
} from "../../../../web/src/stemcells/collection/dress.ts";
export {
  earnedIds,
  freshFeats,
  type Standing,
  standings,
} from "../../../../web/src/stemcells/collection/fresh.ts";
export {
  type Collection,
  FEAT_ACTS,
  type Rarity,
  type Today,
  unlockedPieces,
  wornIdOf,
} from "../../../../../stemcells/ledger/feats.ts";
export {
  actWords,
  COLLECTION,
  featName,
  featProgress,
  featSaid,
  featTakes,
  RARITY_NAMES,
  rewardLine,
  rewardShort,
  SECRET,
  todayCounts,
} from "../../../../../stemcells/words/feats.ts";
