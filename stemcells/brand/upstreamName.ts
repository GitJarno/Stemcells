/**
 * Upstream's name and ours in its place, for the name transform (`nameTransform.ts`) and the
 * phone's build config. Only builds read this file, never an app: it says T3's name, which an
 * app's own code may not (`nameTransform.ts`'s output check).
 */
import { APP_NAME } from "./name.ts";

/** Upstream's name, as a person reads it. */
export const UPSTREAM_NAME = "T3 Code";

/**
 * The exact words, and the possessive ("T3 Code's" reads "Stemcells'"): never
 * inside a path, an id or a longer word. An escape before the name (`\n`)
 * still starts a word.
 */
export const NAME =
  /(?<=^|[^A-Za-z0-9_/\\.-]|\\[nrt])T3 Code(?:(\\?['’])s)?(?![A-Za-z0-9_/\\-]|\.[A-Za-z0-9_])/g;

/** What replaces one match of `NAME`: our name, and the possessive's quote. */
export function ourName(quote: string | undefined): string {
  return quote === undefined ? APP_NAME : `${APP_NAME}${quote}`;
}

/**
 * `value` with each string in it saying our name where it said upstream's:
 * the phone's build config, which writes the name into its channels' names,
 * its widgets' descriptions and its permission prompts. Ids never hold the
 * name as a person reads it (`com.t3tools.t3code`, `t3code`), so they stay.
 */
export function withStemcellsName<Value>(value: Value): Value {
  if (typeof value === "string") {
    return value.replace(NAME, (_match: string, quote: string | undefined) =>
      ourName(quote),
    ) as Value;
  }
  if (Array.isArray(value)) return value.map(withStemcellsName) as Value;
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, withStemcellsName(entry)]),
    ) as Value;
  }
  return value;
}
