/**
 * What a click on a read word offers (decision 6). Picking edits the
 * words, never something beside them: a project's name, a model's, an
 * effort, a count. "Just a word" puts the word in quotes, so nothing reads
 * it. A project only mentioned offers to start there.
 */

import type { WordsCatalog } from "./catalog";
import type { InkKind } from "./ink";
import type { Facts } from "./read";
import type { RosterPlace } from "./places";
import type { Span } from "./text";

export type MenuAction =
  | { readonly kind: "write"; readonly span: Span; readonly text: string }
  | { readonly kind: "quote"; readonly span: Span }
  | { readonly kind: "start-in"; readonly placeId: string };

export interface MenuEntry {
  readonly key: string;
  readonly label: string;
  /** A provider's driver, for its mark. */
  readonly driver?: string;
  readonly current?: boolean;
  readonly rule?: boolean;
  readonly action: MenuAction;
}

export interface MenuSource {
  readonly facts: Facts;
  readonly catalog: WordsCatalog;
  readonly places: readonly RosterPlace[];
  readonly recency: (place: RosterPlace) => number;
  /** The model the draft runs on, for an effort with no model named. */
  readonly model: { readonly instanceId: string; readonly model: string } | null;
}

/** How many recent projects a place's menu lists. */
const RECENT = 5;

const EFFORT_LABEL: Readonly<Record<string, string>> = { xhigh: "Extra high" };
/** An effort as a person reads it: "Max", "Extra high". */
export const effortLabel = (level: string) =>
  EFFORT_LABEL[level] ?? level.slice(0, 1).toUpperCase() + level.slice(1);

export function menuFor(mark: { readonly kind: InkKind } & Span, source: MenuSource): MenuEntry[] {
  const { facts, catalog } = source;
  const at = (s: Span) => s.start <= mark.start && mark.start < s.end;
  const word: MenuEntry = {
    key: "just-a-word",
    label: "Just a word",
    rule: true,
    action: { kind: "quote", span: mark },
  };

  if (mark.kind === "place") {
    const hit = facts.routing.find(at);
    if (!hit) return [];
    const recent = source.places
      .filter((p) => p !== hit.place)
      .toSorted((a, b) => source.recency(b) - source.recency(a))
      .slice(0, RECENT);
    return [
      {
        key: hit.place.place.id,
        label: hit.place.place.name,
        current: true,
        action: { kind: "write", span: hit, text: hit.place.place.name },
      },
      ...recent.map((p) => ({
        key: p.place.id,
        label: p.place.name,
        action: { kind: "write" as const, span: hit, text: p.place.name },
      })),
      word,
    ];
  }

  if (mark.kind === "quiet") {
    const hit = facts.quiet.find(at);
    if (!hit) return [];
    return [
      {
        key: "start-in",
        label: `Start in ${hit.place.place.name}`,
        action: { kind: "start-in", placeId: hit.place.place.id },
      },
    ];
  }

  if (mark.kind === "model") {
    const hit = facts.models.find(at);
    if (!hit) return [];
    const provider = catalog.providers.find((p) => p.id === hit.form.provider.id);
    const current = hit.form.model?.id ?? provider?.defaultModel;
    // The word's own provider first: what it says now opens in view.
    const providers = catalog.providers.toSorted(
      (a, b) => Number(b.id === hit.form.provider.id) - Number(a.id === hit.form.provider.id),
    );
    return [
      ...providers.flatMap((p) =>
        p.models.map((m) => ({
          key: `${p.id}:${m.id}`,
          label: m.name,
          ...(p.driver ? { driver: p.driver } : {}),
          current: p.id === hit.form.provider.id && m.id === current,
          action: { kind: "write" as const, span: hit, text: m.name },
        })),
      ),
      word,
    ];
  }

  if (mark.kind === "effort") {
    const hit = facts.efforts.find(at);
    if (!hit) return [];
    const group = facts.groups.find((g) => g.effort === hit);
    const model = group?.model?.form.model
      ? { instanceId: group.model.form.provider.id, model: group.model.form.model.id }
      : source.model;
    const levels =
      catalog.providers
        .find((p) => p.id === model?.instanceId)
        ?.models.find((m) => m.id === model?.model)?.efforts ?? [];
    return [
      ...levels.map((level) => ({
        key: level,
        label: effortLabel(level),
        current: level === hit.level,
        action: { kind: "write" as const, span: hit, text: level },
      })),
      word,
    ];
  }

  if (mark.kind === "count") {
    const hit = facts.counts.find(at) ?? null;
    const token = hit?.token ?? facts.models.find(at)?.countToken ?? null;
    if (!token) return [];
    return [
      ...[1, 2, 3, 4, 5, 6].map((n) => ({
        key: String(n),
        label: String(n),
        current: hit?.count === n,
        action: { kind: "write" as const, span: token, text: String(n) },
      })),
      word,
    ];
  }
  return [];
}
