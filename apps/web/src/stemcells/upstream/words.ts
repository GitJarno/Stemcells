/**
 * What the composer's reader reads from upstream: the unsent draft a pane
 * holds, the projects as the sidebar lists them, each provider's own model
 * list with its effort levels, and the prompt a document makes.
 * `words.contract.test.ts` pins what this relies on.
 */
import { REASONING_EFFORT_OPTION_IDS } from "@t3tools/client-runtime/state/thread-execution";
import { type EnvironmentId, isProviderAvailable, type ServerProvider } from "@t3tools/contracts";

import type { Node as PmNode } from "@tiptap/pm/model";

import { serializeEditorDoc, serializeSelection } from "../../composer-rich-text-doc";
import { useComposerDraftStore, type DraftId } from "../../composerDraftStore";
import { measureRestingComposerControls } from "../../components/chat/restingComposerControlsMeasurement";
import { resolveRestingComposerControlsLayout } from "../../components/composerFooterLayout";
import { PROVIDER_PRESENTATION } from "../../components/usage/usageProviders";
import { useEnvironmentProviders } from "../../state/environments";
import { useThreadShells } from "../../state/entities";
import { conciseModelName } from "../models/names";
import { isAskisInstance } from "../aski/setup";
import type { CellRef } from "../tabs/layout";
import type { WordsCatalog, WordsProvider } from "../words/catalog";
import type { WordsPlace } from "../words/places";
import { useRailProjects } from "./rail";

/** Upstream's resize watch: what it sets lands in the same frame. */
export { observeResize } from "~/lib/observeResize";

/**
 * A new chat's headline over its composer (`DraftHeroHeadline`), where Aski
 * plays a spawn; null when the chat shows none.
 */
export function draftHeroBox(editor: HTMLElement): DOMRect | null {
  const stack = '[data-chat-composer-stack="true"]';
  const hero = editor
    .closest(stack)
    ?.querySelector("[data-draft-project-trigger]")
    ?.closest(`${stack} > div`);
  const box = hero?.getBoundingClientRect();
  return box && box.width > 0 ? box : null;
}

/**
 * Whether the composer's controls row, fitted as upstream fits it, holds
 * its first control `wider` px wider with every other control at full
 * size. The readout in the model picker's place shows its whole sentence
 * only then (`words/Readout.tsx`).
 */
export function rowHoldsWider(first: HTMLElement, wider: number): boolean {
  const controls = first.parentElement;
  // A resting row sits in a host of its own; the footer's row is its own.
  const host = controls?.matches('[data-chat-composer-resting-controls="true"]')
    ? controls.parentElement
    : controls;
  const measured = controls ? measureRestingComposerControls(controls) : null;
  if (!host || !measured) return true;
  const style = getComputedStyle(host);
  const hostWidth =
    host.clientWidth -
    (Number.parseFloat(style.paddingInlineStart) || 0) -
    (Number.parseFloat(style.paddingInlineEnd) || 0);
  const layout = resolveRestingComposerControlsLayout({
    ...measured,
    naturalFixedWidth: measured.naturalFixedWidth + wider,
    hostWidth,
  });
  return layout.hiddenCount === 0 && (layout.iconOnlyCount ?? 0) === 0;
}

/** The prompt the composer sends for a document, as its editor writes it. */
export function promptOf(doc: PmNode): string {
  return serializeEditorDoc(doc).value;
}

/**
 * The prompt the composer would send for part of a document, `from` to
 * `to`, as its editor writes a selection: a chip as what it stands for
 * (a file's path, a skill's `$name`), code in its backticks.
 */
export function promptBetween(doc: PmNode, from: number, to: number): string {
  return serializeSelection(doc, from, to);
}

/** An unsent draft: where its words will start a Cell. */
export interface WordsDraft {
  readonly draftId: string;
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
    draftId: draftId!,
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
  /** Each place's projects, as `environmentId:projectId`: a place can span machines. */
  readonly members: ReadonlyMap<string, ReadonlyArray<string>>;
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
  const names = JSON.stringify(projects.map((p) => [p.key, p.name, p.memberKeys]));
  const order = JSON.stringify([...latest].toSorted((a, b) => b[1] - a[1]).map(([key]) => key));
  return { places: placesOf(names), members: membersOf(names), recency: recencyOf(order) };
}

function placesOf(names: string): WordsPlace[] {
  return (JSON.parse(names) as [string, string][]).map(([id, name]) => ({ id, name }));
}

function membersOf(names: string): Map<string, string[]> {
  return new Map((JSON.parse(names) as [string, string, string[]][]).map(([id, , m]) => [id, m]));
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
    // Aski's instance is Aski's: no Cell starts on it (`cellInstance.ts`),
    // so no word names it, not even "claude" when it's listed first.
    if (isAskisInstance(snapshot.instanceId)) continue;
    if (snapshot.status === "ready" && snapshot.auth.status !== "unauthenticated")
      ready.add(snapshot.instanceId);
    // One provider word per driver: the first instance listed (the default
    // account) is the one "claude" means.
    const word = providerWord(snapshot);
    const words = word === null || taken.has(word) ? [] : [word];
    if (word !== null) taken.add(word);
    const defaultModel = (snapshot.models.find((m) => m.isDefault) ?? snapshot.models[0])?.slug;
    providers.push({
      id: snapshot.instanceId,
      name: snapshot.displayName ?? word ?? snapshot.instanceId,
      words,
      driver: snapshot.driver,
      ...(defaultModel === undefined ? {} : { defaultModel }),
      models: snapshot.models.map((model) => {
        const effort = effortOf(model.capabilities);
        return {
          id: model.slug,
          name: conciseModelName(model.name),
          efforts: effort?.levels ?? [],
          ...(effort ? { effortOption: effort.option } : {}),
          ...(model.aliases ? { aliases: model.aliases } : {}),
        };
      }),
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

/** A model's effort option and its levels, in the provider's order: its first reasoning-effort choice. */
function effortOf(
  capabilities: ServerProvider["models"][number]["capabilities"],
): { readonly option: string; readonly levels: string[] } | null {
  for (const id of REASONING_EFFORT_OPTION_IDS) {
    const descriptor = capabilities?.optionDescriptors?.find((d) => d.id === id);
    if (descriptor?.type === "select")
      return { option: id, levels: descriptor.options.map((option) => option.id) };
  }
  return null;
}
