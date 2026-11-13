/**
 * The feats a crew earns, in words: each one's name, what it takes, how far along it is and
 * what it unlocks. One copy for every screen (`stemcells/tasks/collection.md`). The rules are
 * `stemcells/ledger/feats.ts`'s; these words only say them.
 */
import type { Feat, FeatState, Measure, Rarity, Today } from "../ledger/feats.ts";

const MINUTE = 60_000;

/** "42 min", "2 h", "2 h 14 min": whole minutes, never rounded up to a feat it didn't reach. */
export function spanWords(ms: number): string {
  const minutes = Math.floor(ms / MINUTE);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  return minutes % 60 === 0 ? `${hours} h` : `${hours} h ${minutes % 60} min`;
}

/** Each feat's name, by its id. */
const NAMES: Readonly<Record<string, string>> = {
  "landings-1": "First landing",
  "landings-10": "Ten landings",
  "landings-50": "Fifty landings",
  "landings-100": "A hundred landings",
  "landings-500": "Five hundred landings",
  "landings-1000": "A thousand landings",
  "merges-1": "First merge",
  "merges-10": "Ten merges",
  "merges-50": "Fifty merges",
  "merges-100": "A hundred merges",
  "cells-10": "Ten Cells",
  "cells-100": "The hundredth Cell",
  "cells-500": "Five hundred Cells",
  "alone-10": "Ten minutes alone",
  "alone-30": "Half an hour alone",
  "alone-60": "An hour alone",
  "alone-120": "Two hours alone",
  "crew-3": "Three in flight",
  "crew-5": "Five in flight",
  "crew-8": "Eight in flight",
  "day-10": "Ten in a day",
  "day-25": "Twenty-five in a day",
  "night-1": "Night flight",
  "quiet-5": "Five without a word",
  "drivers-3": "Mixed crew",
  "settled-10": "Ten settled",
  "settled-100": "A hundred settled",
  "quick-1": "Short hop",
  "straight-1": "Straight through",
  "life-25": "Old hand",
  "days-30": "A month in",
  "days-365": "A year in",
  "dazed-1": "Easy now",
  "tossed-1": "Good arm",
  "stroked-1": "Soft hands",
};

/** A feat's name; its id for one these words don't know yet. */
export const featName = (feat: Feat): string => NAMES[feat.id] ?? feat.id;

/** What a feat takes, as a sentence. */
export function featTakes(feat: Feat): string {
  const n = feat.of;
  switch (feat.measure) {
    case "landings":
      return n === 1 ? "A run landed." : `${n} runs landed.`;
    case "merges":
      return n === 1 ? "A pull request merged." : `${n} pull requests merged.`;
    case "cells":
      return `${n} Cells born.`;
    case "settled":
      return `${n} Cells settled.`;
    case "alone":
      return `A run landed with Done after ${spanWords(n)} on its own, and asked nothing.`;
    case "crew":
      return `${n} Cells in flight at one moment.`;
    case "day":
      return `${n} landings in one day.`;
    case "night":
      return "A landing between midnight and five.";
    case "quiet":
      return `${n} landings in a row with Done, and nothing asked.`;
    case "drivers":
      return `Cells born on ${n} providers.`;
    case "quick":
      return "A run landed with Done inside a minute.";
    case "straight":
      return "A pull request merged within an hour of its Cell's birth.";
    case "life":
      return `One Cell landed ${n} times.`;
    case "days":
      return n >= 365 ? "A year since your first Cell." : "A month since your first Cell.";
    case "dazed":
      return "You poked a Cell until it saw stars.";
    case "tossed":
      return "You threw a Cell across the room.";
    case "stroked":
      return "You stroked a Cell until it leaned in.";
  }
}

const TIMED: ReadonlySet<Measure> = new Set<Measure>(["alone"]);

/** How far along a feat is: "64 of 100", "42 min of 2 h"; nothing for one that takes a single thing. */
export function featProgress(feat: Feat, state: FeatState): string | null {
  if (feat.of <= 1) return null;
  if (TIMED.has(feat.measure)) return `${spanWords(state.have)} of ${spanWords(feat.of)}`;
  return `${state.have} of ${feat.of}`;
}

export const RARITY_NAMES: Readonly<Record<Rarity, string>> = {
  common: "Common",
  rare: "Rare",
  legendary: "Legendary",
  secret: "Secret",
};

/** What each reward is called, by its kind and id. */
const REWARDS: Readonly<Record<string, string>> = {
  "piece:rosette": "The rosette",
  "piece:medal": "The medal",
  "piece:laurel": "The laurel",
  "piece:mantle": "The mantle",
  "piece:pennant": "The pennant",
  "piece:tophat": "The top hat",
  "piece:sprout": "The sprout",
  "piece:crown": "The crown",
  "piece:astronaut": "The helmet",
  "piece:headphones": "The headphones",
  "piece:shades": "The shades",
  "piece:titlebelt": "The title belt",
  "piece:captain": "The captain's hat",
  "piece:jetpack": "The jetpack",
  "piece:viking": "The horned helm",
  "piece:nightcap": "The nightcap",
  "piece:specs": "The specs",
  "piece:scarf": "The scarf",
  "piece:fedora": "The fedora",
  "piece:flatcap": "The flat cap",
  "piece:beret": "The beret",
  "piece:angel": "The halo and wings",
  "piece:plaster": "The plaster",
  "piece:eyepatch": "The eyepatch",
  "piece:hatchling": "The hatchling",
  "act:bow": "The bow",
  "act:flip": "The flip",
  "act:robot": "The robot",
  "act:fireworks": "The fireworks",
  "act:levitate": "The levitation",
  "act:juggle": "The juggle",
  "act:punch": "The punch",
  "act:sweep": "The sweep",
  "act:dash": "The dash",
  "act:rocket": "The rocket",
};

/** What a feat unlocks, by name. */
export const rewardName = (feat: Feat): string =>
  REWARDS[`${feat.reward.kind}:${feat.reward.id}`] ?? feat.reward.id;

/** A reward's name without its article, for a tile: "laurel". */
export const rewardShort = (feat: Feat): string => rewardName(feat).replace(/^The /, "");

/** What a feat unlocks, as a tile's last line: "To wear: the laurel", "An act: the flip". */
export const rewardLine = (feat: Feat): string =>
  `${feat.reward.kind === "piece" ? "To wear" : "An act"}: the ${rewardShort(feat)}`;

/** What a feat's moment says: who did it, where a Cell did, and what is the person's now. */
export const featSaid = (feat: Feat, cell: string | null): string =>
  `${cell === null ? "" : `${cell} did it. `}${rewardName(feat)} is yours.`;

/** The day so far as counts, each with what it counts; the longest run alone once it passes a minute. */
export function todayCounts(
  today: Today,
): ReadonlyArray<{ readonly n: string; readonly of: string }> {
  return [
    { n: String(today.landings), of: today.landings === 1 ? "landing" : "landings" },
    { n: String(today.merges), of: today.merges === 1 ? "merge" : "merges" },
    { n: String(today.cells), of: today.cells === 1 ? "new Cell" : "new Cells" },
    ...(today.aloneMs >= MINUTE ? [{ n: spanWords(today.aloneMs), of: "longest run alone" }] : []),
  ];
}

/** An act's name as a person reads it: "thumbs up" for `thumbsUp`. */
export const actWords = (name: string): string =>
  name.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase();

/** The collection's own words, the same on every screen. */
export const COLLECTION = {
  title: "Collection",
  today: "Today",
  landedToday: "Landed today",
  dressingRoom: "Dressing room",
  toWear: "To wear",
  ownLook: "Its own look",
  noCell: "No Cell open",
  tryOn: "Open a Cell to dress it. Until then, try things on here.",
  nothingYet: "Nothing yet. The first landing brings the first piece.",
  reading: "Reading what your Cells have done…",
  backfilling: "Still reading older Cells…",
  earned: "Feat earned",
  cellsToDress: "Cells to dress",
  isNew: "New",
  dismiss: "Dismiss",
  acts: (n: number) => `Acts · ${n} it can do`,
  feats: (earned: number, all: number) => `Feats · ${earned} of ${all}`,
  rarityFeat: (rarity: string) => `${rarity} feat`,
  putOn: (cell: string) => `Put it on ${cell}`,
} as const;

/** A feat not yet earned that the person may not be told of. */
export const SECRET = { name: "A secret", takes: "Earned by doing it." } as const;
