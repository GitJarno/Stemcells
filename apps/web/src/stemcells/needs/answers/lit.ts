/**
 * What the words in Aski's composer do to each card (stemcells/tasks/aski-room.md, decision 8):
 * the chosen option wears a ring, a reply shows on its card, and an option only a click may
 * choose says so. After Enter, "needs your click" stays lit until a click answers it.
 */
import { useSyncExternalStore } from "react";

/** How the words light a card's option: by its id, or a question's answer by its value. */
export type Lit =
  | { readonly kind: "chosen"; readonly id: string; readonly words: string | null }
  | { readonly kind: "click"; readonly id: string }
  | { readonly kind: "words"; readonly id: string };

export interface LitState {
  /** What the words in the composer do now, by need key. */
  readonly reading: ReadonlyMap<string, Lit>;
  /** Options that need a click since Enter, by need key. */
  readonly asked: ReadonlyMap<string, string>;
}

let state: LitState = { reading: new Map(), asked: new Map() };
const listeners = new Set<() => void>();

function set(next: LitState) {
  state = next;
  for (const listener of listeners) listener();
}

const same = (a: ReadonlyMap<string, Lit>, b: ReadonlyMap<string, Lit>) =>
  a.size === b.size &&
  [...a].every(([key, lit]) => JSON.stringify(b.get(key)) === JSON.stringify(lit));

export const lit = {
  read: (): LitState => state,
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => void listeners.delete(listener);
  },
  /** What the composer's words do now. */
  show(reading: ReadonlyMap<string, Lit>) {
    if (!same(reading, state.reading)) set({ ...state, reading });
  },
  /** Enter left these options for a click. */
  ask(options: ReadonlyArray<readonly [key: string, id: string]>) {
    if (options.length === 0) return;
    set({ ...state, asked: new Map([...state.asked, ...options]) });
  },
  /** The card was answered: its click is no longer asked for. */
  answered(key: string) {
    if (!state.asked.has(key)) return;
    const asked = new Map(state.asked);
    asked.delete(key);
    set({ ...state, asked });
  },
};

export function useLit(): LitState {
  return useSyncExternalStore(lit.subscribe, lit.read, lit.read);
}
