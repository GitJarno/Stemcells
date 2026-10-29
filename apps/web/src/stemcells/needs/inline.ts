/**
 * An ask's words as the chat draws them (stemcells/tasks/unblocking.md, decision 4): links,
 * code and bold, with a bare web address ("acme.dev") made a link, and an issue number one into
 * the Cell's repository (landing-asks.md, 3). The web hands the words to upstream's markdown;
 * the phone draws `spansOf`. Plain TypeScript, which the phone imports.
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

/** An issue number: a pull request or an issue, which GitHub's `/issues/<n>` opens either way. */
const REFERENCE = /(?<![\w&#/])#(\d{1,7})\b/g;

function linked(text: string, pattern: RegExp, link: (match: RegExpMatchArray) => Span): Span[] {
  const spans: Span[] = [];
  let at = 0;
  for (const match of text.matchAll(pattern)) {
    if (match.index > at) spans.push({ kind: "text", text: text.slice(at, match.index) });
    spans.push(link(match));
    at = match.index + match[0].length;
  }
  if (at < text.length) spans.push({ kind: "text", text: text.slice(at) });
  return spans;
}

/** Words outside markup: bare addresses, and with `repo`, references into it. */
const plain = (text: string, repo: string | null): Span[] =>
  linked(text, ADDRESS, ([address]) => ({
    kind: "link",
    text: address,
    url: `https://${address}`,
  })).flatMap((span) =>
    span.kind !== "text" || repo === null
      ? [span]
      : linked(span.text, REFERENCE, ([reference, number]) => ({
          kind: "link",
          text: reference,
          url: `${repo}/issues/${number}`,
        })),
  );

/** `repo`: the Cell's repository on the web, where issue numbers link; null links none. */
export function spansOf(text: string, repo: string | null = null): ReadonlyArray<Span> {
  const spans: Span[] = [];
  let at = 0;
  for (const match of text.matchAll(MARKUP)) {
    if (match.index > at) spans.push(...plain(text.slice(at, match.index), repo));
    const [whole, code, label, url, strong, bare] = match;
    if (code !== undefined) spans.push({ kind: "code", text: code });
    else if (label !== undefined && url !== undefined)
      spans.push({ kind: "link", text: label, url });
    else if (strong !== undefined) spans.push({ kind: "strong", text: strong });
    else if (bare !== undefined) spans.push({ kind: "link", text: bare, url: bare });
    else spans.push({ kind: "text", text: whole });
    at = match.index + whole.length;
  }
  if (at < text.length) spans.push(...plain(text.slice(at), repo));
  return spans;
}

/** Whether the words carry anything beyond plain text: a link, code or bold. */
export const marksUp = (text: string, repo: string | null = null): boolean =>
  spansOf(text, repo).some((span) => span.kind !== "text");

/** The words with each bare address and reference written as a markdown link, the rest as it was. */
export function linkAddresses(text: string, repo: string | null = null): string {
  let at = 0;
  let out = "";
  for (const match of text.matchAll(MARKUP)) {
    out += plainAsMarkdown(text.slice(at, match.index), repo) + match[0];
    at = match.index + match[0].length;
  }
  return out + plainAsMarkdown(text.slice(at), repo);
}

const plainAsMarkdown = (text: string, repo: string | null) =>
  plain(text, repo)
    .map((span) => (span.kind === "link" ? `[${span.text}](${span.url})` : span.text))
    .join("");

/** The repository issue numbers link into: a project's on the web, when GitHub hosts it. */
export const repositoryUrlOf = (
  identity: { readonly provider?: string; readonly webUrl?: string } | null | undefined,
): string | null => (identity?.provider === "github" ? (identity.webUrl ?? null) : null);

/** "Quit and reopen the app": a step, which a Cell writes after its owner word, as a line of its own. */
export const sentenceCase = (text: string): string =>
  /^[a-z]/.test(text) ? text[0]!.toUpperCase() + text.slice(1) : text;
