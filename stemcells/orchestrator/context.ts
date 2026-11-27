// What a client tells the compiler about the person's world (stemcells/tasks/
// aski-orchestrator.md, decision 3), from lists each client already holds: the providers'
// catalogs as models a person can name, the projects by when they were last used, and the
// words that set a Cell up on their own (`gate.ts`). The Mac and the phone build it alike.

import { conciseModelName } from "../models/names.ts";
import type { ModelEntry, PlaceEntry } from "./plan.ts";

/** Aski's own provider instance: no Cell runs on it. */
export const ASKI_INSTANCE = "aski";

/** A provider as its server lists it, as far as a model's entry reads it. */
export interface CatalogProvider {
  readonly instanceId: string;
  /** Switched on, installed and signed in: a Cell could start on it. */
  readonly usable: boolean;
  /** The provider's word, lowercased: "claude", "codex". */
  readonly word: string;
  readonly models: ReadonlyArray<{
    readonly slug: string;
    readonly name: string;
    readonly aliases?: ReadonlyArray<string> | undefined;
    readonly capabilities?:
      | {
          readonly optionDescriptors?:
            | ReadonlyArray<{
                readonly id: string;
                readonly type: string;
                readonly options?: ReadonlyArray<{ readonly id: string }> | undefined;
              }>
            | undefined;
        }
      | null
      | undefined;
  }>;
}

/**
 * The models a Cell can run on, named as a person reads them ("Fable 5.1"), each with its
 * effort levels in the provider's order. `effortOptions` are the option ids that hold an
 * effort, in upstream's order of preference; a model's first one that is a choice is its own.
 */
export function modelEntries(
  providers: ReadonlyArray<CatalogProvider>,
  effortOptions: ReadonlyArray<string>,
): ModelEntry[] {
  const entries: ModelEntry[] = [];
  for (const provider of providers) {
    if (!provider.usable || provider.instanceId === ASKI_INSTANCE) continue;
    for (const model of provider.models) {
      const descriptors = model.capabilities?.optionDescriptors ?? [];
      const option = effortOptions.find((id) =>
        descriptors.some((one) => one.id === id && one.type === "select"),
      );
      const levels =
        option === undefined
          ? []
          : (descriptors.find((one) => one.id === option)?.options ?? []).map((level) => level.id);
      entries.push({
        instanceId: provider.instanceId,
        id: model.slug,
        name: conciseModelName(model.name),
        provider: provider.word,
        efforts: levels,
        ...(option === undefined ? {} : { effortOption: option }),
        ...(model.aliases === undefined || model.aliases.length === 0
          ? {}
          : { aliases: [...model.aliases] }),
      });
    }
  }
  return entries;
}

/**
 * `places` with the most recently used first: by the latest activity of a Cell in each, as an
 * ISO time, and those with none after, in the order given.
 */
export function byRecency<P extends PlaceEntry>(
  places: ReadonlyArray<P>,
  lastUsed: ReadonlyMap<string, string>,
): P[] {
  return places
    .map((place, index) => ({ place, index, at: lastUsed.get(place.id) ?? "" }))
    .sort((a, b) => (a.at === b.at ? a.index - b.index : a.at < b.at ? 1 : -1))
    .map((one) => one.place);
}

/**
 * The words that set a Cell up when a message opens with one (`wantsCompiler`): each project's
 * name, and each model by its name, its family ("fable" of "Fable 5.1"), its aliases and its
 * provider's word. Lowercased.
 */
export function gateNames(
  places: ReadonlyArray<Pick<PlaceEntry, "name" | "aliases">>,
  models: ReadonlyArray<Pick<ModelEntry, "name" | "provider" | "aliases">>,
): Set<string> {
  const names = new Set<string>();
  const add = (word: string) => {
    const flat = word.trim().toLowerCase().replace(/\s+/gu, " ");
    if (flat.length > 0) names.add(flat);
  };
  for (const place of places) {
    add(place.name);
    for (const alias of place.aliases ?? []) add(alias);
  }
  for (const model of models) {
    add(model.name);
    // "Fable 5.1" is said "Fable": the words before its version.
    add(model.name.replace(/\s+\d[\d.]*(?:\s.*)?$/u, ""));
    add(model.provider);
    for (const alias of model.aliases ?? []) add(alias);
  }
  return names;
}
