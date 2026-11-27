/**
 * The pick's line for one agent (`stemcells/tasks/model-pick.md`): each family once, by its name
 * alone ("Opus"), standing for its newest current model, with effort a provider bakes into names
 * ("Flash 3.8 High") folded into that one entry's levels. Older models leave the line; one a Cell
 * still runs stays, with its version. Shared with the phone, so no browser or React here.
 */

import { conciseModelName } from "./names";

export interface LineupModel {
  readonly slug: string;
  /** The provider's own name: "Claude Opus 5.5", "Gemini 3.8 Flash (High)". */
  readonly name: string;
  readonly isLegacy?: boolean | undefined;
  readonly isDefault?: boolean | undefined;
}

export interface LineupLevel<M> {
  /** "high", or "" for the family's model with no effort in its name. */
  readonly id: string;
  readonly label: string;
  readonly model: M;
}

export interface LineupEntry<M> {
  /** Stable within one agent: the family, and its version when it isn't the newest. */
  readonly key: string;
  /** "Opus"; "Opus 4.8" for an older one; a name the rule can't read, as it is. */
  readonly label: string;
  /** What a tap picks: the one a Cell runs when it's here, else the family's default. */
  readonly model: M;
  /** Every model the entry stands for, so a selection anywhere in it lights the entry. */
  readonly models: readonly M[];
  /** Effort baked into names, least first; empty when the family has none. */
  readonly levels: readonly LineupLevel<M>[];
}

/** Effort words a name can end in, least first, with the short label a level reads. */
const LEVELS: ReadonlyArray<readonly [id: string, label: string]> = [
  ["minimal", "Minimal"],
  ["low", "Low"],
  ["medium", "Medium"],
  ["high", "High"],
  ["xhigh", "XHigh"],
  ["max", "Max"],
];
const LEVEL_BY_WORD = new Map(LEVELS.map(([id, label]) => [label, id]));
const LEVEL_RANK = new Map(LEVELS.map(([id], index) => [id, index]));
/** A family that is only a vendor's word says nothing without its version: "GPT 5.5". */
const VENDOR_ONLY = new Set(["gpt", "gemini", "claude"]);

interface Parsed {
  readonly family: string;
  /** null when the name carries no version the rule can read. */
  readonly version: readonly number[] | null;
  readonly versionText: string;
  /** "high", or "" for none. */
  readonly level: string;
}

const CONCISE = /^(.+?) (\d+(?:\.\d+)*)(?: (\S+))?$/;

function parseModelName(name: string): Parsed {
  const concise = conciseModelName(name);
  const match = CONCISE.exec(concise);
  const level = match?.[3] === undefined ? "" : LEVEL_BY_WORD.get(match[3]);
  if (!match || level === undefined) {
    return { family: concise, version: null, versionText: "", level: "" };
  }
  return {
    family: match[1]!,
    version: match[2]!.split(".").map(Number),
    versionText: match[2]!,
    level,
  };
}

/** How a person reads a model on its own, as the composer's button does: "Opus", "Opus 4.8". */
export function pickName(model: Pick<LineupModel, "name" | "isLegacy">): string {
  const parsed = parseModelName(model.name);
  if (parsed.version === null) return parsed.family;
  const levelLabel = parsed.level === "" ? "" : ` ${labelOf(parsed.level)}`;
  const versioned = model.isLegacy === true || VENDOR_ONLY.has(parsed.family.toLowerCase());
  return `${parsed.family}${versioned ? ` ${parsed.versionText}` : ""}${levelLabel}`;
}

function labelOf(level: string): string {
  return LEVELS.find(([id]) => id === level)?.[1] ?? level;
}

function newer(a: readonly number[], b: readonly number[]): boolean {
  for (let index = 0; index < Math.max(a.length, b.length); index++) {
    const difference = (a[index] ?? 0) - (b[index] ?? 0);
    if (difference !== 0) return difference > 0;
  }
  return false;
}

interface Group<M> {
  readonly familyKey: string;
  readonly family: string;
  readonly parsed: Parsed;
  readonly models: M[];
  readonly levels: Map<string, M>;
  current: boolean;
}

/** Every family-and-version once, in the provider's order of first appearance. */
function groupsOf<M extends LineupModel>(models: readonly M[]): Group<M>[] {
  const groups = new Map<string, Group<M>>();
  for (const model of models) {
    const parsed = parseModelName(model.name);
    const familyKey =
      parsed.version !== null && VENDOR_ONLY.has(parsed.family.toLowerCase())
        ? `${parsed.family} ${parsed.versionText}`.toLowerCase()
        : parsed.family.toLowerCase();
    const key = `${familyKey}\u0000${parsed.versionText}`;
    let group = groups.get(key);
    if (!group) {
      group = {
        familyKey,
        family: parsed.family,
        parsed,
        models: [],
        levels: new Map(),
        current: false,
      };
      groups.set(key, group);
    }
    group.models.push(model);
    if (!group.levels.has(parsed.level)) group.levels.set(parsed.level, model);
    if (model.isLegacy !== true) group.current = true;
  }
  return [...groups.values()];
}

/** One selected slug, several (a send to several models), or none. */
type Selected = string | readonly string[] | null;
const selectedSet = (selected: Selected): ReadonlySet<string> =>
  new Set(selected === null ? [] : typeof selected === "string" ? [selected] : selected);

function entryOf<M extends LineupModel>(
  group: Group<M>,
  newest: boolean,
  selected: ReadonlySet<string>,
): LineupEntry<M> {
  const chosen =
    group.models.find((model) => selected.has(model.slug)) ??
    group.models.find((model) => model.isDefault === true) ??
    group.levels.get("") ??
    group.models[0]!;
  const levels =
    group.levels.size > 1 || !group.levels.has("")
      ? [...group.levels]
          .sort(([a], [b]) => (LEVEL_RANK.get(a) ?? -1) - (LEVEL_RANK.get(b) ?? -1))
          .map(([id, model]) => ({ id, label: id === "" ? "Default" : labelOf(id), model }))
      : [];
  const versioned =
    group.parsed.version !== null && (!newest || VENDOR_ONLY.has(group.family.toLowerCase()));
  return {
    key: newest ? group.familyKey : `${group.familyKey} ${group.parsed.versionText}`,
    label: versioned ? `${group.family} ${group.parsed.versionText}` : group.family,
    model: chosen,
    models: group.models,
    // One level alone is no choice.
    levels: levels.length > 1 ? levels : [],
  };
}

/**
 * One agent's line: each family's newest current version, then, beside its family, any older
 * one `selected` names. Models arrive in the provider's order, which the line keeps.
 */
export function lineup<M extends LineupModel>(
  models: readonly M[],
  selected: Selected = null,
): LineupEntry<M>[] {
  const picked = selectedSet(selected);
  const groups = groupsOf(models);
  const newestByFamily = new Map<string, Group<M>>();
  for (const group of groups) {
    if (!group.current) continue;
    const seen = newestByFamily.get(group.familyKey);
    const version = group.parsed.version ?? [];
    if (!seen || newer(version, seen.parsed.version ?? [])) {
      newestByFamily.set(group.familyKey, group);
    }
  }
  const pickedGroups = groups.filter((group) =>
    group.models.some((model) => picked.has(model.slug)),
  );
  const entries: LineupEntry<M>[] = [];
  const placed = new Set<string>();
  for (const group of groups) {
    if (placed.has(group.familyKey)) continue;
    const newest = newestByFamily.get(group.familyKey);
    const older = pickedGroups.filter(
      (candidate) => candidate.familyKey === group.familyKey && candidate !== newest,
    );
    if (!newest && older.length === 0) continue;
    placed.add(group.familyKey);
    if (newest) entries.push(entryOf(newest, true, picked));
    for (const candidate of older) entries.push(entryOf(candidate, false, picked));
  }
  return entries;
}

/** Every family-and-version, each with its version, for search: "Opus 5.5", "Opus 4.8". */
export function everyVersion<M extends LineupModel>(
  models: readonly M[],
  selected: Selected = null,
): LineupEntry<M>[] {
  const picked = selectedSet(selected);
  return groupsOf(models).map((group) => entryOf(group, false, picked));
}

/** The entry a selection lights, and the level within it. */
export function selectedIn<M extends LineupModel>(
  entries: readonly LineupEntry<M>[],
  slug: string | null,
): { readonly entry: LineupEntry<M>; readonly level: string | null } | null {
  for (const entry of entries) {
    if (!entry.models.some((model) => model.slug === slug)) continue;
    const level = entry.levels.find((candidate) => candidate.model.slug === slug)?.id ?? null;
    return { entry, level };
  }
  return null;
}

/** A level as a row of levels reads it: "Extra High" is XHigh, as model names write it. */
export function levelLabel(label: string): string {
  return label === "Extra High" ? "XHigh" : label;
}

/** Access in one word each, by its runtime mode; a mode's description says the rest. */
export const ACCESS_WORDS: Readonly<Record<string, string>> = {
  "approval-required": "Supervised",
  "auto-accept-edits": "Edits",
  auto: "Auto",
  "full-access": "Full",
};
