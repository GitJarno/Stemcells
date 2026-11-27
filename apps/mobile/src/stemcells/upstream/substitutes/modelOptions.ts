// Replaces `lib/modelOptions.ts` (`substitutes.cjs`): Aski's instance is offered only beside a
// selection already on it (Aski's own chat); no other list offers or badges it, nor does a new
// chat start there. Every option reads as the Mac names it ("Opus 5.5"; its button "Opus").
import type * as Upstream from "../../../lib/modelOptions";
import {
  buildModelOptions as upstreamBuildModelOptions,
  resolveDefaultableModelSelection as upstreamResolveDefaultableModelSelection,
  resolveSelectableModelSelection as upstreamResolveSelectableModelSelection,
} from "../../../lib/modelOptions";
import { conciseModelName, pickName } from "../../models/kit";
import { cellConfig, isAskisInstance } from "../cellInstance";

export * from "../../../lib/modelOptions";

export function buildModelOptions(
  ...[config, fallback, locked, ...rest]: Parameters<typeof Upstream.buildModelOptions>
): ReturnType<typeof Upstream.buildModelOptions> {
  const askis = isAskisInstance(fallback?.instanceId) || isAskisInstance(locked);
  return upstreamBuildModelOptions(
    askis ? config : cellConfig(config),
    fallback,
    locked,
    ...rest,
  ).map((option) => ({
    ...option,
    label: conciseModelName(option.label),
    shortName: pickName({ name: option.shortName ?? option.label, isLegacy: option.isLegacy }),
  }));
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
