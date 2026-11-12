// What a Cell wears: every day the look of its own name (the cast packs); on the days it
// dresses for a season, the season's outfit instead, or the season's piece with its own look in
// the slots left free. Every Cell dresses on a feast, one day in three through a longer season.
// Pure, and the same on every screen; the reasons are in `stemcells/tasks/cell-cast.md`.

import { type Pack, type PackOutfit, PACKS } from "./kit.ts";
import { cellNameOf } from "./name.ts";

const THEMES: ReadonlyMap<string, Pack> = new Map(PACKS.map((pack) => [pack.theme, pack]));

/** The cast: each look by the Cell name it is drawn for, in lower case. */
const CAST: ReadonlyMap<string, PackOutfit> = new Map(
  PACKS.filter((pack) => pack.cast).flatMap((pack) =>
    pack.outfits.map((outfit) => [outfit.name, outfit] as const),
  ),
);

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

/** The days before each month begins, in a year of 365. */
const BEFORE = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];

/** How many days a window holds past its first, counting over the new year when it runs past it. */
const length = (from: string, to: string): number => {
  const ordinal = (day: string) => BEFORE[Number(day.slice(0, 2)) - 1]! + Number(day.slice(3));
  const days = ordinal(to) - ordinal(from);
  return days >= 0 ? days : days + 365;
};

/** Whether the window `from`–`to` holds a month-day, over the new year when it runs past it. */
const holds = (from: string, to: string, monthDay: string): boolean =>
  from <= to ? monthDay >= from && monthDay <= to : monthDay >= from || monthDay <= to;

/** The window a season holds in `year` (none for a year a moving feast doesn't name). */
function windowIn(season: NonNullable<Pack["season"]>, year: string | undefined) {
  if ("from" in season) return season;
  const dated = year === undefined ? undefined : season.years[year];
  return dated === undefined ? undefined : { from: dated[0], to: dated[1], feast: undefined };
}

/** A season that ends within this many days of its first, three weeks or less, is a feast whole. */
const FEAST_DAYS = 20;

/** Through a longer season a Cell dresses for it one day in this many, on days of its own. */
const DRESSES_ONE_DAY_IN = 3n;

/**
 * The season `day` falls in and whether the day is its feast: all of a short season, a long
 * one's own named days. The narrowest window when two hold the day; a tie goes to a pack drawn
 * since the original's, which dresses the season whole, then to the first by name.
 */
function seasonAt(day: string): { readonly theme: string; readonly feast: boolean } | undefined {
  if (asked?.day === day) return asked.season;
  const monthDay = day.slice(-5);
  const year = day.length > 5 ? day.slice(0, 4) : undefined;
  let best: { theme: string; days: number; feast: boolean } | undefined;
  const packs = [...THEMES.values()].sort(
    (a, b) => Number(b.authored) - Number(a.authored) || (a.theme < b.theme ? -1 : 1),
  );
  for (const { theme, season } of packs) {
    const window = season === null ? undefined : windowIn(season, year);
    if (window === undefined || !holds(window.from, window.to, monthDay)) continue;
    const days = length(window.from, window.to);
    if (best !== undefined && days >= best.days) continue;
    const feast =
      days <= FEAST_DAYS ||
      (window.feast !== undefined && holds(window.feast[0], window.feast[1], monthDay));
    best = { theme, days, feast };
  }
  asked = { day, season: best };
  return best;
}

/** The last day asked about and its season: every Cell in view asks for the same day, each render. */
let asked:
  | { readonly day: string; readonly season: { theme: string; feast: boolean } | undefined }
  | undefined;

/** The season `day` falls in (`2027-02-06`, or a month-day, `02-06`, which holds no moving feast). */
export function seasonOn(day: string): string | undefined {
  return seasonAt(day)?.theme;
}

/** Whether the Cell `codename` names dresses for `season` on `day`, off its feast: its own days, the same on every screen. */
export const dressesFor = (codename: string, season: string, day: string): boolean =>
  score(`${codename}|${season}|${day}`) % DRESSES_ONE_DAY_IN === 0n;

/** What a season deals: an outfit, or a piece of a pack that has none. */
interface Item {
  readonly name: string;
  readonly outfit?: PackOutfit | undefined;
}

/** A season's items: its outfits where it has any, else its pieces (posed variants aside). */
function itemsOf(theme: string): readonly Item[] {
  const pack = THEMES.get(theme);
  if (pack === undefined) return [];
  if (pack.outfits.length > 0) return pack.outfits.map((outfit) => ({ name: outfit.name, outfit }));
  return pack.pieces.filter((piece) => !piece.posed).map((piece) => ({ name: piece.name }));
}

const rankings = new Map<string, readonly string[]>();

/** A season's items in a codename's order: each scores `codename|theme|item`, the highest first, ties by name. */
function ranked(codename: string, theme: string): readonly string[] {
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

/** What a Cell wears, as ids in the order worn, each in the slots those before it leave free (`theme/piece`, or `outfit:theme/outfit~colourway`). */
export interface Look {
  readonly worn: readonly string[];
  /** What it holds while in view but doesn't wear today: its own look under a season's outfit, its season's item between its dress-up days. */
  readonly held?: readonly string[] | undefined;
}

/** The id an outfit is worn by: `outfit:theme/outfit`, with `~colourway` for one of its own. */
const outfitId = (outfit: PackOutfit, colourway: string): string =>
  `outfit:${outfit.theme}/${outfit.name}${colourway === "" ? "" : `~${colourway}`}`;

/** The colourway of `outfit` among `worn`: `""` for its own fabric; undefined when it isn't worn, or in a colourway it no longer has. */
function colourwayIn(worn: readonly string[], outfit: PackOutfit): string | undefined {
  const base = outfitId(outfit, "");
  for (const id of worn) {
    if (id === base) return "";
    const colourway = id.startsWith(`${base}~`) ? id.slice(base.length + 1) : undefined;
    if (colourway !== undefined && outfit.colourways.some((c) => c.id === colourway))
      return colourway;
  }
  return undefined;
}

/**
 * The season's item for each of `codenames`, who dress for it, in seat order: a Cell keeps the
 * one `kept` names; each other takes its first in a silhouette and colour family no one else
 * wears, else the least held, an outfit worn twice in another colourway.
 */
function dealSeason(
  theme: string,
  codenames: readonly string[],
  kept: ReadonlyMap<string, Look>,
): ReadonlyMap<string, string> {
  const items = new Map(itemsOf(theme).map((item) => [item.name, item]));
  const dealt = new Map<string, string>();
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
    dealt.set(
      codename,
      item.outfit === undefined ? `${theme}/${item.name}` : outfitId(item.outfit, colourway),
    );
  };
  const fresh: string[] = [];
  for (const codename of codenames) {
    const known = keptOf(theme, items, kept.get(codename));
    if (known === undefined) fresh.push(codename);
    else take(codename, known.item, known.colourway);
  }
  for (const codename of fresh) {
    const order = ranked(codename, theme).map((name) => items.get(name)!);
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
    const picked: Item = item;
    const options = rankedBy(
      ["", ...(picked.outfit?.colourways.map((c) => c.id) ?? [])],
      (colourway) => `${codename}|${theme}|${picked.name}|${colourway}`,
    );
    const worn = colourways.get(picked.name);
    take(codename, picked, options.find((c) => !worn?.has(c)) ?? options[0]!);
  }
  return dealt;
}

/** Every id a kept look holds: what it wears, then what it has put by. */
const holding = (kept: Look | undefined): readonly string[] => [
  ...(kept?.worn ?? []),
  ...(kept?.held ?? []),
];

/** The item of `theme` a kept look holds, when the season still deals it. */
function keptOf(
  theme: string,
  items: ReadonlyMap<string, Item>,
  kept: Look | undefined,
): { readonly item: Item; readonly colourway: string } | undefined {
  for (const id of holding(kept)) {
    if (id.startsWith(`${theme}/`)) {
      const item = items.get(id.slice(theme.length + 1));
      if (item !== undefined && item.outfit === undefined) return { item, colourway: "" };
    }
    for (const item of items.values()) {
      const colourway = item.outfit === undefined ? undefined : colourwayIn([id], item.outfit);
      if (colourway !== undefined) return { item, colourway };
    }
  }
  return undefined;
}

/** The id of the item of `theme` a kept look holds, when the season still deals it. */
function heldItem(
  theme: string,
  items: ReadonlyMap<string, Item>,
  kept: Look | undefined,
): string | undefined {
  const known = keptOf(theme, items, kept);
  if (known === undefined) return undefined;
  return known.item.outfit === undefined
    ? `${theme}/${known.item.name}`
    : outfitId(known.item.outfit, known.colourway);
}

/** The look drawn for the Cell name `name` (`Fox`), as the id it is worn by; undefined for a name with none. */
export function castLookOf(name: string): string | undefined {
  const outfit = CAST.get(name.toLowerCase());
  return outfit === undefined ? undefined : outfitId(outfit, "");
}

/**
 * Each Cell's own look, in seat order: its name's, in the colourway `kept` names; of two Cells
 * of one name in view, the second wears the look's next colourway while it has one.
 */
function dealOwn(
  codenames: readonly string[],
  kept: ReadonlyMap<string, Look>,
): ReadonlyMap<string, string> {
  const dealt = new Map<string, string>();
  const worn = new Map<string, Set<string>>();
  const take = (codename: string, outfit: PackOutfit, colourway: string): void => {
    worn.set(outfit.name, (worn.get(outfit.name) ?? new Set()).add(colourway));
    dealt.set(codename, outfitId(outfit, colourway));
  };
  const fresh: [string, PackOutfit][] = [];
  for (const codename of codenames) {
    const outfit = CAST.get(cellNameOf(codename).toLowerCase());
    if (outfit === undefined) continue;
    const colourway = colourwayIn(holding(kept.get(codename)), outfit);
    if (colourway === undefined) fresh.push([codename, outfit]);
    else take(codename, outfit, colourway);
  }
  for (const [codename, outfit] of fresh) {
    const options = ["", ...outfit.colourways.map((c) => c.id)];
    take(codename, outfit, options.find((c) => !worn.get(outfit.name)?.has(c)) ?? "");
  }
  return dealt;
}

/**
 * What each Cell of a crew wears on `day` (`2027-02-06`, or a month-day), as ids, Cells in seat
 * order: its own look; on a day it dresses for the season, the season's outfit in its place,
 * or the season's piece before it. A Cell `kept` names keeps its colourways and its season's
 * item, from one dress-up day to the next. Nothing kept, every screen agrees.
 */
export function looksOf(
  codenames: readonly string[],
  day: string,
  kept: ReadonlyMap<string, Look> = new Map(),
): ReadonlyMap<string, Look> {
  const season = seasonAt(day);
  const items =
    season === undefined
      ? new Map<string, Item>()
      : new Map(itemsOf(season.theme).map((item) => [item.name, item]));
  const dresses = (codename: string) =>
    season !== undefined && (season.feast || dressesFor(codename, season.theme, day));
  const seasonal =
    season === undefined
      ? new Map<string, string>()
      : dealSeason(season.theme, codenames.filter(dresses), kept);
  const own = dealOwn(codenames, kept);
  return new Map(
    codenames.map((codename) => {
      const item = seasonal.get(codename);
      const mine = own.get(codename);
      const whole = item?.startsWith("outfit:") === true;
      // Between its dress-up days a Cell puts its season's item by, to wear the same one again.
      const put =
        season === undefined || dresses(codename)
          ? undefined
          : heldItem(season.theme, items, kept.get(codename));
      const held = [whole ? mine : undefined, put].filter((id): id is string => id !== undefined);
      const worn = [item, whole ? undefined : mine].filter((id): id is string => id !== undefined);
      return [codename, held.length > 0 ? { worn, held } : { worn }];
    }),
  );
}

/** What a Cell named `name` wears on `day` when dealt alone. */
export function lookOf(name: string, day: string): readonly string[] {
  return looksOf([name], day).get(name)?.worn ?? [];
}
