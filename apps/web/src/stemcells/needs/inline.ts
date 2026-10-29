/**
 * An ask's words as the chat draws them (stemcells/tasks/unblocking.md, decision 4): links,
 * code and bold, with a bare web address ("acmecoffee.com") made a link. The web hands the words
 * to upstream's markdown; the phone draws `spansOf`. Plain TypeScript, which the phone imports.
 */

export type Span =
  | { readonly kind: "text"; readonly text: string }
  | { readonly kind: "code"; readonly text: string }
  | { readonly kind: "strong"; readonly text: string }
  | { readonly kind: "link"; readonly text: string; readonly url: string };

/** What the words mark up, in the order the tokenizer tries them. */
const MARKUP =
  /`([^`\n]+)`|\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)|\*\*([^*\n]+)\*\*|(https?:\/\/[^\s<>()[\]`"']+[^\s<>()[\]`"'.,;:!?])/g;

/**
 * A bare address: a name, a dot and a top-level domain people type, not a file's extension
 * ("notes.md", "install.sh" and "app.ts" stay words), and not part of an email or a path.
 */
const ADDRESS =
  /(?<![\w@./-])((?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+(?:com|net|org|io|ai|app|dev|co|fi|de|uk|eu|se|no|dk|nl|fr|es|ch|be|us|ca|jp|tv|fm|dj|gg|info|xyz|cloud|store|shop|studio|games|music))(?![\w-]|\.\w)(\/[^\s)\]]*[^\s)\].,;:!?])?/gi;

function addresses(text: string): Span[] {
  const spans: Span[] = [];
  let at = 0;
  for (const match of text.matchAll(ADDRESS)) {
    if (match.index > at) spans.push({ kind: "text", text: text.slice(at, match.index) });
    spans.push({ kind: "link", text: match[0], url: `https://${match[0]}` });
    at = match.index + match[0].length;
  }
  if (at < text.length) spans.push({ kind: "text", text: text.slice(at) });
  return spans;
}

export function spansOf(text: string): ReadonlyArray<Span> {
  const spans: Span[] = [];
  let at = 0;
  for (const match of text.matchAll(MARKUP)) {
    if (match.index > at) spans.push(...addresses(text.slice(at, match.index)));
    const [whole, code, label, url, strong, bare] = match;
    if (code !== undefined) spans.push({ kind: "code", text: code });
    else if (label !== undefined && url !== undefined)
      spans.push({ kind: "link", text: label, url });
    else if (strong !== undefined) spans.push({ kind: "strong", text: strong });
    else if (bare !== undefined) spans.push({ kind: "link", text: bare, url: bare });
    else spans.push({ kind: "text", text: whole });
    at = match.index + whole.length;
  }
  if (at < text.length) spans.push(...addresses(text.slice(at)));
  return spans;
}

/** Whether the words carry anything beyond plain text: a link, code or bold. */
export const marksUp = (text: string): boolean =>
  spansOf(text).some((span) => span.kind !== "text");

/** The words with each bare address written as a markdown link, everything else as it was. */
export function linkAddresses(text: string): string {
  let at = 0;
  let out = "";
  for (const match of text.matchAll(MARKUP)) {
    out += addressesAsMarkdown(text.slice(at, match.index)) + match[0];
    at = match.index + match[0].length;
  }
  return out + addressesAsMarkdown(text.slice(at));
}

const addressesAsMarkdown = (text: string) =>
  addresses(text)
    .map((span) => (span.kind === "link" ? `[${span.text}](${span.url})` : span.text))
    .join("");

/** "Quit and reopen the app": a step, which a Cell writes after its owner word, as a line of its own. */
export const sentenceCase = (text: string): string =>
  /^[a-z]/.test(text) ? text[0]!.toUpperCase() + text.slice(1) : text;
