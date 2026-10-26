/**
 * The places a new chat's words start Cells in, by draft, for the hero over its composer: "What
 * should we build in Harbor and Atlas?", or "in 3 projects?" past two (decision 10). The words
 * write them; the hero reads them (`upstream/substitutes/DraftHeroProjectHeading.tsx`). One
 * place, or none, leaves the hero as it is.
 */
import { useSyncExternalStore } from "react";

const byDraft = new Map<string, readonly string[]>();
const listeners = new Set<() => void>();

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/** What the hero names for `draftId`: its places when there are several, else nothing. */
export function showPlaces(draftId: string, places: readonly string[] | null): void {
  const next = places !== null && places.length > 1 ? places : null;
  const last = byDraft.get(draftId) ?? null;
  if (JSON.stringify(last) === JSON.stringify(next)) return;
  if (next === null) byDraft.delete(draftId);
  else byDraft.set(draftId, next);
  for (const listener of listeners) listener();
}

/** The places the hero names for a draft; null when it names its own project, as upstream does. */
export function useShownPlaces(draftId: string | null): readonly string[] | null {
  return useSyncExternalStore(subscribe, () =>
    draftId === null ? null : (byDraft.get(draftId) ?? null),
  );
}
