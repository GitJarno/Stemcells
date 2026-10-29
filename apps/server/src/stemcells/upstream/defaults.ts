import * as Effect from "effect/Effect";
import * as Path from "effect/Path";

import * as ServerConfig from "../../config.ts";
import * as ServerSettings from "../../serverSettings.ts";

// What Stemcells' defaults take from upstream: the server switches whose
// default we choose differently, and the state folder our own records live in.

/** Where Stemcells records the defaults it has applied, each by its setting's name. */
export const appliedDefaultsPath = Effect.gen(function* () {
  const config = yield* ServerConfig.ServerConfig;
  const path = yield* Path.Path;
  return path.join(config.stateDir, "stemcells", "defaults.json");
});

/**
 * Upstream's switches Stemcells sets differently: a thread settling as soon as its pull
 * request merges, and a thread a usage limit stopped resuming at the reset.
 */
export type Switch = "sidebarAutoSettleOnMerge" | "autoResumeLimitedThreads";

export const readSwitch = Effect.fn("UpstreamDefaults.readSwitch")(function* (key: Switch) {
  const settings = yield* ServerSettings.ServerSettingsService;
  return (yield* settings.getSettings)[key];
});

export const setSwitch = Effect.fn("UpstreamDefaults.setSwitch")(function* (
  key: Switch,
  on: boolean,
) {
  const settings = yield* ServerSettings.ServerSettingsService;
  yield* settings.updateSettings({ [key]: on });
});
