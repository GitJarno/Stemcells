// The windows a Claude Cell compacts at, as Settings › Providers offers them.
// The window is a Claude instance's `autoCompactWindow`. Empty is the
// default, 500k, which the server hands at launch (server
// `stemcells/compaction/claudeWindow.ts`, whose default must match this
// one); "1000000", the CLI's largest, is the model's own, since the CLI caps
// the window at the model's context.

export const DEFAULT_COMPACT_WINDOW = "500000";
export const MODEL_OWN_WINDOW = "1000000";

/** The windows offered besides the model's own. */
export const OFFERED_WINDOWS: ReadonlyArray<string> = ["300000", DEFAULT_COMPACT_WINDOW, "750000"];

export interface CompactWindowChoice {
  readonly value: string;
  readonly label: string;
}

/** The window an instance's config names, or the default when it names none. */
export function compactWindowIn(config: unknown): string {
  const value =
    config !== null && typeof config === "object"
      ? (config as Record<string, unknown>).autoCompactWindow
      : undefined;
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : DEFAULT_COMPACT_WINDOW;
}

/** How a window reads: "500k"; the model's own by name. */
export function windowLabel(window: string): string {
  if (window === MODEL_OWN_WINDOW) return "Model's own";
  return `${Math.round(Number(window) / 1_000)}k`;
}

/**
 * The windows to offer when `current` is picked: the usual three, the
 * current one in its place when it is none of them (a window typed before
 * this row existed), and the model's own last.
 */
export function compactWindowChoices(current: string): ReadonlyArray<CompactWindowChoice> {
  const windows =
    current === MODEL_OWN_WINDOW || OFFERED_WINDOWS.includes(current)
      ? OFFERED_WINDOWS
      : [...OFFERED_WINDOWS, current].toSorted((left, right) => Number(left) - Number(right));
  return [...windows, MODEL_OWN_WINDOW].map((value) => ({ value, label: windowLabel(value) }));
}

/**
 * `config` with `window` picked. The default takes the key out, so the
 * instance follows the default; undefined when nothing else is left.
 */
export function configWithCompactWindow(
  config: unknown,
  window: string,
): Record<string, unknown> | undefined {
  const next: Record<string, unknown> =
    config !== null && typeof config === "object" ? { ...(config as Record<string, unknown>) } : {};
  if (window === DEFAULT_COMPACT_WINDOW) {
    delete next.autoCompactWindow;
  } else {
    next.autoCompactWindow = window;
  }
  return Object.keys(next).length > 0 ? next : undefined;
}
