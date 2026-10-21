/**
 * The app's name, wherever a person reads it. The web
 * (`apps/web/src/stemcells/brand/name.ts`), the phone
 * (`apps/mobile/src/stemcells/brand/name.ts`) and the phone's build config
 * take it from here. The desktop app names itself the same in
 * `DesktopEnvironment.ts`; the web's `appName.contract.test.ts` keeps the two
 * equal.
 */
export const APP_NAME = "Stemcells";

/** Upstream's name, as a person reads it. */
const UPSTREAM_NAME = /T3 Code/g;

/**
 * `value` with each string in it saying our name where it said upstream's:
 * the phone's build config, which writes the name into its channels' names,
 * its widgets' descriptions and its permission prompts. Ids never hold the
 * name as a person reads it (`com.t3tools.t3code`, `t3code`), so they stay.
 */
export function withStemcellsName<Value>(value: Value): Value {
  if (typeof value === "string") return value.replace(UPSTREAM_NAME, APP_NAME) as Value;
  if (Array.isArray(value)) return value.map(withStemcellsName) as Value;
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, withStemcellsName(entry)]),
    ) as Value;
  }
  return value;
}
