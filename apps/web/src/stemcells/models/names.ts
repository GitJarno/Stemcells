/**
 * How Stemcells writes a model's name: family first, then version, without
 * the vendor word. "GPT-6.1 Sol" reads "Sol 6.1", "Claude Opus 5.5" reads
 * "Opus 5.5": the provider's mark or colour beside the name already says
 * whose model it is.
 *
 * - A name with no family keeps its vendor word: "GPT-5.5" reads "GPT 5.5".
 * - A family is one or two words: "GPT-5.3-Codex-Spark" reads "Codex Spark 5.3".
 * - A variant baked into the name is a distinct model, so it stays, as a
 *   trailing word, with or without its parentheses: "Gemini 3.8 Flash (High)"
 *   and "Gemini 3.8 Flash High" both read "Flash 3.8 High". Only the effort
 *   words upstream's models carry count as a variant, never as a family.
 * - A name the rule doesn't recognise comes back unchanged.
 *
 * Display only. Slugs, ids and anything sent to a provider keep the name the
 * provider gave.
 */

/** Each variant as it's written; "Xhigh" is how a name built from a slug spells it. */
const VARIANTS: Record<string, string> = {
  Minimal: "Minimal",
  Low: "Low",
  Medium: "Medium",
  High: "High",
  XHigh: "XHigh",
  Xhigh: "XHigh",
  Max: "Max",
};
const VARIANT_WORD = `(?:${Object.keys(VARIANTS).join("|")})`;

const VENDOR = "(Claude|Gemini|GPT)";
const VERSION = String.raw`(\d+(?:\.\d+)*)`;
const WORD = String.raw`(?!${VARIANT_WORD}\b)[A-Z][a-z]+`;
const FAMILY = `(${WORD}(?:[ -]${WORD})?)`;
const VARIANT = String.raw`(?:[ -]\((${VARIANT_WORD})\)|[ -](${VARIANT_WORD}))?`;

/** "GPT-6.1 Sol", "GPT-5.3-Codex-Spark", "GPT-5.5", "Gemini 3.8 Flash (High)". */
const VERSION_FIRST = new RegExp(`^${VENDOR}[ -]${VERSION}(?:[ -]${FAMILY})?${VARIANT}$`);
/** "Claude Opus 5.5", "Claude Fable 5.1". */
const FAMILY_FIRST = new RegExp(`^${VENDOR} ${FAMILY} ${VERSION}${VARIANT}$`);

/** "Codex-Spark" reads "Codex Spark"; "Xhigh" reads "XHigh". */
const words = (
  family: string | undefined,
  version: string | undefined,
  variant: string | undefined,
) =>
  [family?.replace("-", " "), version, variant === undefined ? undefined : VARIANTS[variant]]
    .filter((part) => part !== undefined)
    .join(" ");

export function conciseModelName(name: string): string {
  const familyFirst = FAMILY_FIRST.exec(name);
  if (familyFirst) {
    const [, , family, version, inParentheses, bare] = familyFirst;
    return words(family, version, inParentheses ?? bare);
  }
  const versionFirst = VERSION_FIRST.exec(name);
  if (versionFirst) {
    const [, vendor, version, family, inParentheses, bare] = versionFirst;
    return words(family ?? vendor, version, inParentheses ?? bare);
  }
  return name;
}

/** The model with its name (and short name) as a person reads it; the same object when nothing changes. */
export function withConciseName<
  T extends { readonly name: string; readonly shortName?: string | undefined },
>(model: T): T {
  const name = conciseModelName(model.name);
  const shortName = model.shortName === undefined ? undefined : conciseModelName(model.shortName);
  if (name === model.name && shortName === model.shortName) return model;
  return { ...model, name, ...(shortName === undefined ? {} : { shortName }) };
}
