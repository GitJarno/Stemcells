/**
 * Where Claude Cells compact. Claude Code takes the window at launch, from
 * the Agent SDK's `settings` (its `--settings` flag layer, which outranks
 * the person's own `~/.claude/settings.json`, model entries included), and
 * compacts once the context reaches the window, capped at the model's
 * context, less 33,000 tokens it holds back: room for the reply (at most
 * 20,000) and a 13,000 buffer. Measured with the CLI's `getContextUsage`
 * (Claude Code 2.1.305): 500k compacts at 467k, and a 200k model under 500k
 * at 167k.
 *
 * Upstream keeps the window in each Claude instance's `autoCompactWindow`,
 * empty meaning none is handed. In Stemcells empty is the default, 500k;
 * "Model's own" hands 1,000,000, the CLI's largest, which it caps at the
 * model's context. Settings › Providers sets it (web
 * `stemcells/compaction/windows.ts`, whose default must match this one).
 */

/** The window a Claude Cell compacts at until the person picks another. */
export const DEFAULT_COMPACT_WINDOW = "500000";

/** What the CLI holds back below the window before it compacts. */
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
 * Where a chat compacts, as its token usage reports it: the window handed
 * at launch, capped at the model's context (`maxTokens`; null when the
 * catalog doesn't know the model), less what the CLI holds back. With no
 * window handed, the person's own Claude settings decide, which the server
 * doesn't read: none.
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
