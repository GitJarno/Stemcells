import { closeCloudSwitches } from "./switches.ts";

/**
 * What a build reads its public configuration from (`scripts/lib/public-config.ts`, which every
 * app's build config and the dev runner load): without the cloud switches, and with them gone
 * from the build's own environment too, since the configs also read that.
 */
export function closedBuildEnv(
  env: Record<string, string | undefined>,
): Record<string, string | undefined> {
  closeCloudSwitches(process.env);
  closeCloudSwitches(env);
  return env;
}
