// What a Cell wears, dealt from the kit's packs (`kit/packs.json`): one
// piece of the outfit theme the person picked (the house theme until they
// do) and, in a season while Seasons is on, one of that season's. Dealt by
// codename over a roster, and a Cell keeps its look while it stays awake.
// Pure; the deal is tested from fixtures/looks.json.

import { type Pack, PACKS, pieceOf } from "./kit.ts";

const THEMES: ReadonlyMap<string, Pack> = new Map(PACKS.map((pack) => [pack.theme, pack]));

/** The outfit theme every Cell wears from until the person picks another. */
export const HOUSE = "house";

/** The outfit themes a person may pick, the themes with no season: the house theme first, then by name. */
export const OUTFITS: readonly string[] = [
  HOUSE,
  ...[...THEMES.values()]
    .filter((pack) => pack.theme !== HOUSE && pack.season === null)
    .map((pack) => pack.theme)
    .sort(),
];

/** What a Mac dresses its Cells in: Settings › General › Outfit theme and Seasons. */
export interface Dress {
  /** An outfit theme; one the data does not hold as an outfit wears the house theme. */
  readonly theme: string;
  /** Whether a season's pieces are worn over the theme while it runs. */
  readonly seasons: boolean;
}

/** What a Mac dresses its Cells in until the person says otherwise. */
export const HOUSE_DRESS: Dress = { theme: HOUSE, seasons: true };

/** The themes worn on `day` in `dress`: its outfit theme, then the season's while one runs and Seasons is on. */
export function themesOn(day: string, dress: Dress = HOUSE_DRESS): readonly string[] {
  const theme = OUTFITS.includes(dress.theme) ? dress.theme : HOUSE;
  const season = dress.seasons ? seasonOn(day) : undefined;
  return [theme, ...(season === undefined ? [] : [season])];
}

const MASK = (1n << 64n) - 1n;

/** A rendezvous score: FNV-1a over the words' UTF-8 in 64 bits, every bit then spread by SplitMix64's finaliser. */
export function score(words: string): bigint {
  let hash = 0xcbf29ce484222325n;
  for (const byte of new TextEncoder().encode(words))
    hash = ((hash ^ BigInt(byte)) * 0x100000001b3n) & MASK;
  let z = (hash + 0x9e3779b97f4a7c15n) & MASK;
  z = ((z ^ (z >> 30n)) * 0xbf58476d1ce4e5b9n) & MASK;
  z = ((z ^ (z >> 27n)) * 0x94d049bb133111ebn) & MASK;
  return z ^ (z >> 31n);
}

/** A date as the month-day seasons are written in, on the screen's own calendar. */
export const dayOf = (date: Date): string =>
  `${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

/** How many days a season's window holds, counting over the new year when it runs past it. */
const length = (from: string, to: string): number => {
  const ordinal = (day: string) => Number(day.slice(0, 2)) * 31 + Number(day.slice(3));
  const days = ordinal(to) - ordinal(from);
  return days >= 0 ? days : days + 12 * 31;
};

/** The season `day` falls in: the narrowest window when two hold it, ties to the first by name. */
export function seasonOn(day: string): string | undefined {
  let best: { theme: string; days: number } | undefined;
  for (const { theme, season } of [...THEMES.values()].sort((a, b) =>
    a.theme < b.theme ? -1 : 1,
  )) {
    if (season === null) continue;
    const holds =
      season.from <= season.to
        ? day >= season.from && day <= season.to
        : day >= season.from || day <= season.to;
    const days = length(season.from, season.to);
    if (holds && (best === undefined || days < best.days)) best = { theme, days };
  }
  return best?.theme;
}

const rankings = new Map<string, readonly string[]>();

/** A theme's pieces in a codename's order: each scores `codename|theme|piece`, the highest first, ties by name. */
export function ranked(codename: string, theme: string): readonly string[] {
  const key = `${codename}|${theme}`;
  const known = rankings.get(key);
  if (known !== undefined) return known;
  const order = (THEMES.get(theme)?.pieces ?? [])
    .map((piece) => piece.name)
    .sort()
    .map((piece) => ({ piece, score: score(`${codename}|${theme}|${piece}`) }))
    .sort((a, b) => (a.score === b.score ? 0 : a.score > b.score ? -1 : 1))
    .map((p) => p.piece);
  rankings.set(key, order);
  return order;
}

/** What a Cell was dealt, a piece of each theme worn, and of those what it wears: the season's wins a slot both fill. */
export interface Look {
  readonly dealt: readonly string[];
  readonly worn: readonly string[];
}

/**
 * What each Cell of a roster wears on `day` (month-day) in `dress`, as
 * `theme/piece` ids, the Cells given in the order they took their seats, the
 * first-born first. In each theme worn, a Cell `kept` names keeps the piece it was
 * dealt there; each other Cell takes the first piece in its own order among
 * those held least, so no two wear the same piece while the theme has one
 * free, and no Cell's look changes while it stays awake. With nothing kept
 * the deal is the roster's own, the same on every screen.
 */
export function looksOf(
  codenames: readonly string[],
  day: string,
  kept: ReadonlyMap<string, Look> = new Map(),
  dress: Dress = HOUSE_DRESS,
): ReadonlyMap<string, Look> {
  const themes = themesOn(day, dress);
  const dealt = new Map<string, string[]>(codenames.map((c) => [c, []]));
  for (const theme of themes) {
    const held = new Map<string, number>();
    const take = (codename: string, piece: string): void => {
      held.set(piece, (held.get(piece) ?? 0) + 1);
      dealt.get(codename)?.push(`${theme}/${piece}`);
    };
    const keeps = (codename: string): string | undefined => {
      const id = kept.get(codename)?.dealt.find((d) => d.startsWith(`${theme}/`));
      const piece = id?.slice(theme.length + 1);
      return piece !== undefined && pieceOf(`${theme}/${piece}`) !== undefined ? piece : undefined;
    };
    const fresh: string[] = [];
    for (const codename of codenames) {
      const piece = keeps(codename);
      if (piece === undefined) fresh.push(codename);
      else take(codename, piece);
    }
    for (const codename of fresh) {
      let piece: string | undefined;
      for (const p of ranked(codename, theme)) {
        if (piece === undefined || (held.get(p) ?? 0) < (held.get(piece) ?? 0)) piece = p;
      }
      if (piece !== undefined) take(codename, piece);
    }
  }
  const slotOf = (id: string) => pieceOf(id)?.slot;
  return new Map(
    [...dealt].map(([codename, ids]) => {
      const ordered = themes.flatMap((theme) => ids.filter((id) => id.startsWith(`${theme}/`)));
      const worn = ordered.filter(
        (id, i) => !ordered.slice(i + 1).some((later) => slotOf(later) === slotOf(id)),
      );
      return [codename, { dealt: ordered, worn }];
    }),
  );
}
