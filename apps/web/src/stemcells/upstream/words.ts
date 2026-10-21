/**
 * What the composer's reader reads from upstream: the unsent draft a pane
 * holds, the projects as the sidebar lists them, and each provider's own
 * model list with its effort levels. `words.contract.test.ts` pins what
 * this relies on.
 */
import { REASONING_EFFORT_OPTION_IDS } from "@t3tools/client-runtime/state/thread-execution";
import { type EnvironmentId, isProviderAvailable, type ServerProvider } from "@t3tools/contracts";

import { useComposerDraftStore, type DraftId } from "../../composerDraftStore";
import { PROVIDER_PRESENTATION } from "../../components/usage/usageProviders";
import { useEnvironmentProviders } from "../../state/environments";
import { useThreadShells } from "../../state/entities";
import { conciseModelName } from "../models/names";
import type { CellRef } from "../tabs/layout";
import type { WordsCatalog, WordsProvider } from "../words/catalog";
import type { WordsPlace } from "../words/places";
import { useRailProjects } from "./rail";

/** An unsent draft: where its words will start a Cell. */
export interface WordsDraft {
  readonly environmentId: string;
  /** `environmentId:projectId`, as the rail keys a project. */
  readonly projectKey: string;
}

/** The draft a pane holds, until its first message goes; null for a sent chat or none. */
export function useWordsDraft(cell: CellRef | null): WordsDraft | null {
  const draftId = cell?.draftId ?? null;
  const session = useComposerDraftStore((store) =>
    draftId === null ? null : store.getDraftSession(draftId as DraftId),
  );
  if (session === null || session.promotedTo != null) return null;
  return {
    environmentId: session.environmentId,
    projectKey: `${session.environmentId}:${session.projectId}`,
  };
}

/**
 * The projects as places, keyed as the rail keys them, and how recently
 * each was worked in (higher is more recent). Both change only when a name
 * or the order does, not on every chat's update.
 */
export function useWordsPlaces(): {
  readonly places: ReadonlyArray<WordsPlace>;
  readonly recency: ReadonlyMap<string, number>;
} {
  const projects = useRailProjects();
  const shells = useThreadShells();
  const groupOf = new Map<string, string>();
  for (const p of projects) for (const member of p.memberKeys) groupOf.set(member, p.key);
  const latest = new Map<string, number>();
  for (const shell of shells) {
    const group = groupOf.get(`${shell.environmentId}:${shell.projectId}`);
    if (group === undefined) continue;
    latest.set(group, Math.max(latest.get(group) ?? 0, Date.parse(shell.updatedAt)));
  }
  const names = JSON.stringify(projects.map((p) => [p.key, p.name]));
  const order = JSON.stringify([...latest].toSorted((a, b) => b[1] - a[1]).map(([key]) => key));
  return { places: placesOf(names), recency: recencyOf(order) };
}

function placesOf(names: string): WordsPlace[] {
  return (JSON.parse(names) as [string, string][]).map(([id, name]) => ({ id, name }));
}

function recencyOf(order: string): Map<string, number> {
  const keys = JSON.parse(order) as string[];
  return new Map(keys.map((key, i) => [key, keys.length - i]));
}

/** The models an environment's providers offer, and which providers can start a Cell now. */
export function useWordsCatalog(environmentId: string | null): {
  readonly catalog: WordsCatalog;
  readonly ready: ReadonlySet<string>;
} {
  const providers = useEnvironmentProviders();
  const snapshots =
    environmentId === null ? undefined : providers.get(environmentId as EnvironmentId);
  return wordsCatalogOf(snapshots ?? NO_PROVIDERS);
}

const NO_PROVIDERS: ReadonlyArray<ServerProvider> = [];

export function wordsCatalogOf(snapshots: ReadonlyArray<ServerProvider>): {
  readonly catalog: WordsCatalog;
  readonly ready: ReadonlySet<string>;
} {
  const ready = new Set<string>();
  const taken = new Set<string>();
  const providers: WordsProvider[] = [];
  for (const snapshot of snapshots) {
    if (!snapshot.enabled || !isProviderAvailable(snapshot)) continue;
    if (snapshot.status === "ready" && snapshot.auth.status !== "unauthenticated")
      ready.add(snapshot.instanceId);
    // One provider word per driver: the first instance listed (the default
    // account) is the one "claude" means.
    const word = providerWord(snapshot);
    const words = word === null || taken.has(word) ? [] : [word];
    if (word !== null) taken.add(word);
    providers.push({
      id: snapshot.instanceId,
      name: snapshot.displayName ?? word ?? snapshot.instanceId,
      words,
      models: snapshot.models.map((model) => ({
        id: model.slug,
        name: conciseModelName(model.name),
        efforts: effortsOf(model.capabilities),
        ...(model.aliases ? { aliases: model.aliases } : {}),
      })),
    });
  }
  return { catalog: { providers }, ready };
}

/** "Claude Code" is read as "claude", "Grok Build" as "grok": the label's first word. */
function providerWord(snapshot: ServerProvider): string | null {
  const presentation = Object.values(PROVIDER_PRESENTATION).find(
    (entry) => entry.driverKind === snapshot.driver,
  );
  const label = presentation?.label ?? snapshot.displayName;
  const word = label?.trim().split(/\s+/)[0]?.toLowerCase();
  return word === undefined || word.length === 0 ? null : word;
}

/** A model's effort levels, in the provider's order: its first reasoning-effort choice. */
function effortsOf(capabilities: ServerProvider["models"][number]["capabilities"]): string[] {
  for (const id of REASONING_EFFORT_OPTION_IDS) {
    const descriptor = capabilities?.optionDescriptors?.find((d) => d.id === id);
    if (descriptor?.type === "select") return descriptor.options.map((option) => option.id);
  }
  return [];
}
