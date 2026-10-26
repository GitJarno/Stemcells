/**
 * Where Claude Cells compact. Claude Code takes the window at launch from the Agent SDK's
 * `settings` (its `--settings` layer outranks `~/.claude/settings.json`, model entries too) and
 * compacts at the window, capped at the model's context, less `COMPACT_RESERVE`. Measured on
 * Claude Code 2.1.305: 500k compacts at 467k, and a 200k model under 500k at 167k.
 */

/**
 * The window a Claude Cell compacts at until the person picks another: upstream's empty
 * `autoCompactWindow` hands none, ours hands this. "Model's own" hands 1,000,000, which the CLI
 * caps at the model's context. Web `stemcells/compaction/windows.ts` must default the same.
 */
export const DEFAULT_COMPACT_WINDOW = "500000";

/**
 * What the CLI holds back below the window before it compacts: room for the reply (at most
 * 20,000) and a 13,000 buffer.
 */
export const COMPACT_RESERVE = 33_000;

/** The window handed to Claude for an instance's setting. */
export function compactWindowOf(setting: string): string {
  return setting.trim() === "" ? DEFAULT_COMPACT_WINDOW : setting;
}

/** An instance's settings with the window its Cells launch with. */
export function withCompactWindow<Settings extends { readonly autoCompactWindow: string }>(
  settings: Settings,
): Settings {
  return { ...settings, autoCompactWindow: compactWindowOf(settings.autoCompactWindow) };
}

/**
 * Where a chat compacts, as its token usage reports it: the launch window capped at the model's
 * context (`maxTokens`, null when the catalog doesn't know the model), less what the CLI holds
 * back. None when no window is handed: the person's own Claude settings decide, unread here.
 */
export function claudeAutoCompactThreshold(
  autoCompactWindow: string,
  maxTokens: number | null,
): { readonly autoCompactThreshold?: number } {
  const window = Number(autoCompactWindow);
  if (!Number.isFinite(window) || window <= 0) return {};
  const threshold = Math.min(window, maxTokens ?? window) - COMPACT_RESERVE;
  return threshold > 0 ? { autoCompactThreshold: threshold } : {};
}
