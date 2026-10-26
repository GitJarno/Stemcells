/**
 * How Stemcells shows a model's name (display only; ids and sends keep the provider's): family,
 * then version, no vendor word ("Claude Opus 5.5" reads "Opus 5.5"). With no family the vendor
 * stays ("GPT 5.5"); an effort word baked in stays as a trailing variant ("Flash 3.8 High"),
 * never a family. A name the rule doesn't know comes back unchanged.
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
