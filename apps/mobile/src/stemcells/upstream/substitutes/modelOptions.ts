// Replaces `lib/modelOptions.ts` (`substitutes.cjs`): Aski's instance is offered only beside a
// selection already on it, which is Aski's own chat, since the composer moves a Cell's off it
// (`ThreadComposer.tsx`). Every other list (a Cell's composer and settings, a new chat, a
// scheduled task) neither offers it nor badges Claude for it, and a new chat never starts there.
import type * as Upstream from "../../../lib/modelOptions";
import {
  buildModelOptions as upstreamBuildModelOptions,
  resolveDefaultableModelSelection as upstreamResolveDefaultableModelSelection,
  resolveSelectableModelSelection as upstreamResolveSelectableModelSelection,
} from "../../../lib/modelOptions";
import { cellConfig, isAskisInstance } from "../cellInstance";

export * from "../../../lib/modelOptions";

export function buildModelOptions(
  ...[config, fallback, locked, ...rest]: Parameters<typeof Upstream.buildModelOptions>
): ReturnType<typeof Upstream.buildModelOptions> {
  const askis = isAskisInstance(fallback?.instanceId) || isAskisInstance(locked);
  return upstreamBuildModelOptions(askis ? config : cellConfig(config), fallback, locked, ...rest);
}

// Both pick the model a new chat starts on: a draft's, the project's default, the last pick.
export function resolveSelectableModelSelection(
  ...[config, selection, projectId]: Parameters<typeof Upstream.resolveSelectableModelSelection>
): ReturnType<typeof Upstream.resolveSelectableModelSelection> {
  return isAskisInstance(selection?.instanceId)
    ? null
    : upstreamResolveSelectableModelSelection(config, selection, projectId);
}

export function resolveDefaultableModelSelection(
  ...[config, selection, projectId]: Parameters<typeof Upstream.resolveDefaultableModelSelection>
): ReturnType<typeof Upstream.resolveDefaultableModelSelection> {
  return isAskisInstance(selection?.instanceId)
    ? null
    : upstreamResolveDefaultableModelSelection(config, selection, projectId);
}
