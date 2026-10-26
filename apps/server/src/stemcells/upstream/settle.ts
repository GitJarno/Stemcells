import * as Effect from "effect/Effect";
import * as Path from "effect/Path";

import * as ServerConfig from "../../config.ts";
import * as ServerSettings from "../../serverSettings.ts";

// What Stemcells' settle default takes from upstream: the server setting
// that settles a thread as soon as its pull request merges, and the state
// folder our own records live in.

/** Where Stemcells records the defaults it has applied, each by its setting's name. */
export const appliedDefaultsPath = Effect.gen(function* () {
  const config = yield* ServerConfig.ServerConfig;
  const path = yield* Path.Path;
  return path.join(config.stateDir, "stemcells", "defaults.json");
});

/** Whether a thread settles as soon as its pull request merges. */
export const settlesOnMerge = Effect.gen(function* () {
  const settings = yield* ServerSettings.ServerSettingsService;
  return (yield* settings.getSettings).sidebarAutoSettleOnMerge;
});

export const setSettleOnMerge = Effect.fn("UpstreamSettle.setSettleOnMerge")(function* (
  on: boolean,
) {
  const settings = yield* ServerSettings.ServerSettingsService;
  yield* settings.updateSettings({ sidebarAutoSettleOnMerge: on });
});
