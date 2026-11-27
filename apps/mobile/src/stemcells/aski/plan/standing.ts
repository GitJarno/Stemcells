// How tall the tray stands over the composer on the screen in front, for what floats there
// (Aski's button): it stands clear of the tray's controls, not on them.

let height = 0;
const listeners = new Set<() => void>();

export const standing = {
  read: (): number => height,
  subscribe: (listener: () => void): (() => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  /** The tray's height on the screen in front; 0 once it is gone or behind another screen. */
  set: (next: number): void => {
    const rounded = Math.round(next);
    if (rounded === height) return;
    height = rounded;
    for (const listener of listeners) listener();
  },
};
