/**
 * The variables that switch on upstream's hosted services: its relay and Clerk sign-in, tracing
 * to an address a variable names, PostHog, the phone's updates from T3's Expo project. No
 * Stemcells build or process reads one, from a copied `.env` or a shell (seams.md, No telemetry).
 */
const CLOUD_SWITCH =
  /^(?:(?:T3CODE|VITE|EXPO_PUBLIC)_(?:[A-Z0-9]+_)*(?:RELAY_URL|CLERK|OTLP|POSTHOG)(?:_[A-Z0-9_]*)?|T3CODE_MOBILE_UPDATES_ENABLED)$/;

export const isCloudSwitch = (name: string) => CLOUD_SWITCH.test(name);

/** What every Stemcells build and process runs with, whatever its environment said. */
export const FORCED: Readonly<Record<string, string>> = { T3CODE_TELEMETRY_ENABLED: "false" };

/** Takes every cloud switch out of `env`, in place, and returns the names it took. */
export function closeCloudSwitches(env: Record<string, string | undefined>): string[] {
  const taken = Object.keys(env).filter(isCloudSwitch);
  for (const name of taken) delete env[name];
  Object.assign(env, FORCED);
  return taken;
}
