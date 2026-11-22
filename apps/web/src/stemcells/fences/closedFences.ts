// Which of our fences a reply has closed (stemcells/tasks/chart-fence.md, settings-in-chat.md).
// Upstream draws every fence through `MarkdownCodeBlock`, whose substitute draws ours only for a
// fence named here: one still streaming, or never closed, stays the code block it is.
import { createContext } from "react";

/** Our fences' languages. */
const OUR_FENCES: ReadonlyArray<string> = ["chart", "setting"];

const MAY_HOLD = /(?:`{3,}|~{3,})[ \t]*(?:chart|setting)\b/;

export interface FencesInView {
  /** Each closed fence of ours, by `fenceKey`. */
  readonly closed: ReadonlySet<string>;
  /** The server the reply's chat runs on, where a card reads and writes its settings. */
  readonly environmentId: string | undefined;
}

export const FencesInView = createContext<FencesInView | null>(null);

/** A fence's key: its language and its code, as the parsed block holds it. */
export const fenceKey = (lang: string, code: string) => `${lang}\u0000${code.replace(/\n+$/, "")}`;

/** The closed fences of ours in `text`, each by its key; empty when none can be. */
export function closedFences(text: string): ReadonlySet<string> {
  const closed = new Set<string>();
  if (!MAY_HOLD.test(text)) return closed;
  let open: { marker: string; prefix: string; lang: string; lines: string[] } | null = null;
  for (const line of text.split("\n")) {
    if (open === null) {
      // A fence in a quote or a list keeps its prefix on every line, which the parse drops.
      const start = /^([ \t>]*)(`{3,}|~{3,})[ \t]*([^\s`~]*)/.exec(line);
      if (start !== null)
        open = { prefix: start[1]!, marker: start[2]!, lang: start[3]!, lines: [] };
      continue;
    }
    const body = line.startsWith(open.prefix) ? line.slice(open.prefix.length) : line.trimStart();
    const end = /^[ \t]*(`{3,}|~{3,})[ \t]*$/.exec(body)?.[1];
    if (end !== undefined && end[0] === open.marker[0] && end.length >= open.marker.length) {
      if (OUR_FENCES.includes(open.lang)) closed.add(fenceKey(open.lang, open.lines.join("\n")));
      open = null;
      continue;
    }
    open.lines.push(body);
  }
  return closed;
}
