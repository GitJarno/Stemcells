/**
 * Esc in the composer drops Aski's plan, while Aski thinks or once the
 * plan waits for a second Enter: the words read back as they did before
 * it, and nothing starts (stemcells/tasks/prompting.md, decision 12).
 */

/** The key as the composer's window hears it. */
export interface EscKey {
  readonly key: string;
  /** An input method is composing: its Esc cancels the composition. */
  readonly isComposing: boolean;
}

/** Where focus stands as it's pressed. */
export interface EscAt {
  /** In this composer: Esc anywhere else is someone else's. */
  readonly inComposer: boolean;
  /** A word's menu is open: Esc closes that first. */
  readonly menuOpen: boolean;
}

export function escDropsPlan(key: EscKey, at: EscAt): boolean {
  return key.key === "Escape" && !key.isComposing && at.inComposer && !at.menuOpen;
}
