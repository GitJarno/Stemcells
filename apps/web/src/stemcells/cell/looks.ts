// What a Cell wears, dealt from the packs (`kit/packs.json` and `art/packs/`):
// one item of the outfit theme the person picked (the house theme until
// they do) and, in a season while Seasons is on, one of that season's. An
// item is an outfit, dealt as one in one of its colourways, where the pack
// has outfits, and a piece where it has none. The season's item is dealt
// first, being the day's; the theme's takes the slots it leaves free. Dealt
// by codename over the crew in view, no two alike while the catalogue
// lasts, and a Cell keeps its look while it stays in view. Pure; the deal is
// tested from fixtures/looks.json.

import { type Pack, type PackOutfit, PACKS, type Slot } from "./kit.ts";

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
  /** Whether a season's items are worn while it runs, the theme's in the slots they leave free. */
  readonly seasons: boolean;
}

/** What a Mac dresses its Cells in until the person says otherwise. */
export const HOUSE_DRESS: Dress = { theme: HOUSE, seasons: true };

/** The themes worn on `day` in `dress`, in the order they are dealt: the season's while one runs and Seasons is on, then its outfit theme. */
export function themesOn(day: string, dress: Dress = HOUSE_DRESS): readonly string[] {
  const theme = OUTFITS.includes(dress.theme) ? dress.theme : HOUSE;
  const season = dress.seasons ? seasonOn(day) : undefined;
  return [...(season === undefined ? [] : [season]), theme];
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

/** A date as the deal reads it, on the screen's own calendar: year, month and day (`2027-02-06`). */
export const dayOf = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

/** How many days a season's window holds, counting over the new year when it runs past it. */
const length = (from: string, to: string): number => {
  const ordinal = (day: string) => Number(day.slice(0, 2)) * 31 + Number(day.slice(3));
  const days = ordinal(to) - ordinal(from);
  return days >= 0 ? days : days + 12 * 31;
};

/** The window a season holds in `year` (none for a year a moving feast doesn't name). */
function windowIn(season: NonNullable<Pack["season"]>, year: string | undefined) {
  if ("from" in season) return season;
  const dated = year === undefined ? undefined : season.years[year];
  return dated === undefined ? undefined : { from: dated[0], to: dated[1] };
}

/**
 * The season `day` falls in (`2027-02-06`, or a month-day, `02-06`, which
 * holds no moving feast): the narrowest window when two hold it, ties to the
 * first by name.
 */
export function seasonOn(day: string): string | undefined {
  const monthDay = day.slice(-5);
  const year = day.length > 5 ? day.slice(0, 4) : undefined;
  let best: { theme: string; days: number } | undefined;
  for (const { theme, season } of [...THEMES.values()].sort((a, b) =>
    a.theme < b.theme ? -1 : 1,
  )) {
    const window = season === null ? undefined : windowIn(season, year);
    if (window === undefined) continue;
    const holds =
      window.from <= window.to
        ? monthDay >= window.from && monthDay <= window.to
        : monthDay >= window.from || monthDay <= window.to;
    const days = length(window.from, window.to);
    if (holds && (best === undefined || days < best.days)) best = { theme, days };
  }
  return best?.theme;
}

/** What a theme deals: an outfit or a piece, the slots it fills, and what keeps two apart. */
interface Item {
  readonly name: string;
  readonly slots: readonly WornSlot[];
  readonly outfit?: PackOutfit | undefined;
}

/** Where a look wears something: the pieces' slots, and the body's dye. */
type WornSlot = Slot | "fabric";

/** A theme's items: its outfits where it has any, else its pieces (posed variants aside). */
function itemsOf(theme: string): readonly Item[] {
  const pack = THEMES.get(theme);
  if (pack === undefined) return [];
  if (pack.outfits.length > 0)
    return pack.outfits.map((outfit) => ({
      name: outfit.name,
      outfit,
      slots: [
        ...(["headwear", "face", "wrap", "back"] as const).filter(
          (slot) => outfit[slot] !== undefined,
        ),
        ...(outfit.fabric !== undefined || outfit.outfit !== undefined
          ? (["fabric"] as const)
          : []),
      ],
    }));
  return pack.pieces
    .filter((piece) => !piece.posed)
    .map((piece) => ({ name: piece.name, slots: [piece.slot] }));
}

const rankings = new Map<string, readonly string[]>();

/** A theme's items in a codename's order: each scores `codename|theme|item`, the highest first, ties by name. */
export function ranked(codename: string, theme: string): readonly string[] {
  const key = `${codename}|${theme}`;
  const known = rankings.get(key);
  if (known !== undefined) return known;
  const order = rankedBy(
    itemsOf(theme).map((item) => item.name),
    (name) => `${codename}|${theme}|${name}`,
  );
  rankings.set(key, order);
  return order;
}

/** `names` by their scores under `key`, the highest first, ties by name. */
const rankedBy = (names: readonly string[], key: (name: string) => string): string[] =>
  // Copied, then sorted: the phone runs this, and Hermes has no `toSorted`.
  [...names]
    .sort()
    .map((name) => ({ name, score: score(key(name)) }))
    .sort((a, b) => (a.score === b.score ? 0 : a.score > b.score ? -1 : 1))
    .map((p) => p.name);

/** What a Cell wears, as ids in the order dealt, the season's first (`theme/piece`, or `outfit:theme/outfit~colourway`). */
export interface Look {
  readonly worn: readonly string[];
}

/** The id an item is worn by: a piece's `theme/piece`; an outfit's `outfit:theme/outfit`, with `~colourway` for one of its own. */
const idOf = (theme: string, item: Item, colourway: string): string =>
  item.outfit === undefined
    ? `${theme}/${item.name}`
    : `outfit:${theme}/${item.name}${colourway === "" ? "" : `~${colourway}`}`;

/** The theme, item and colourway an id names, when its theme still deals it. */
function parse(id: string): { theme: string; item: Item; colourway: string } | undefined {
  const outfit = id.startsWith("outfit:");
  const [path = "", colourway = ""] = (outfit ? id.slice("outfit:".length) : id).split("~");
  const at = path.indexOf("/");
  const theme = path.slice(0, at);
  const item = itemsOf(theme).find((i) => i.name === path.slice(at + 1));
  if (item === undefined || (item.outfit !== undefined) !== outfit) return undefined;
  if (colourway !== "" && !item.outfit?.colourways.some((c) => c.id === colourway))
    return undefined;
  return { theme, item, colourway };
}

/**
 * What each Cell of a crew wears on `day` (`2027-02-06`, or a month-day) in
 * `dress`, as ids, the Cells given in the order they took their seats, the
 * first-born first. Each theme worn is dealt in turn, the season's first
 * (`themesOn`). In each, a Cell `kept` names keeps what it was dealt there
 * while it still fits. Each other Cell takes the first item in
 * its own order that fits the slots it has free and whose silhouette and
 * colour family no other Cell wears; past those (and for pieces, which name
 * neither), the first among those held least. An outfit worn twice takes a
 * colourway the other doesn't. With nothing kept the deal is the crew's own,
 * the same on every screen.
 */
export function looksOf(
  codenames: readonly string[],
  day: string,
  kept: ReadonlyMap<string, Look> = new Map(),
  dress: Dress = HOUSE_DRESS,
): ReadonlyMap<string, Look> {
  const themes = themesOn(day, dress);
  const dealt = new Map<string, string[]>(codenames.map((c) => [c, []]));
  const filled = new Map<string, Set<WornSlot>>(codenames.map((c) => [c, new Set()]));
  const fits = (codename: string, item: Item) =>
    item.slots.every((slot) => !filled.get(codename)!.has(slot));
  for (const theme of themes) {
    const items = new Map(itemsOf(theme).map((item) => [item.name, item]));
    const held = new Map<string, number>();
    const silhouettes = new Set<string>();
    const families = new Set<string>();
    const colourways = new Map<string, Set<string>>();
    const take = (codename: string, item: Item, colourway: string): void => {
      held.set(item.name, (held.get(item.name) ?? 0) + 1);
      if (item.outfit !== undefined) {
        silhouettes.add(item.outfit.silhouette);
        families.add(item.outfit.family);
        colourways.set(item.name, (colourways.get(item.name) ?? new Set()).add(colourway));
      }
      for (const slot of item.slots) filled.get(codename)!.add(slot);
      dealt.get(codename)!.push(idOf(theme, item, colourway));
    };
    const keeps = (codename: string) => {
      for (const id of kept.get(codename)?.worn ?? []) {
        const known = parse(id);
        if (known?.theme === theme && fits(codename, known.item)) return known;
      }
      return undefined;
    };
    const fresh: string[] = [];
    for (const codename of codenames) {
      const known = keeps(codename);
      if (known === undefined) fresh.push(codename);
      else take(codename, known.item, known.colourway);
    }
    for (const codename of fresh) {
      const order = ranked(codename, theme)
        .map((name) => items.get(name)!)
        .filter((item) => fits(codename, item));
      let item = order.find(
        (i) =>
          i.outfit !== undefined &&
          !silhouettes.has(i.outfit.silhouette) &&
          !families.has(i.outfit.family),
      );
      if (item === undefined)
        for (const i of order)
          if (item === undefined || (held.get(i.name) ?? 0) < (held.get(item.name) ?? 0)) item = i;
      if (item === undefined) continue;
      const options = rankedBy(
        ["", ...(item.outfit?.colourways.map((c) => c.id) ?? [])],
        (colourway) => `${codename}|${theme}|${item.name}|${colourway}`,
      );
      const worn = colourways.get(item.name);
      take(codename, item, options.find((c) => !worn?.has(c)) ?? options[0]!);
    }
  }
  return new Map([...dealt].map(([codename, worn]) => [codename, { worn }]));
}
