/**
 * A project's one line for Aski's planner (stemcells/tasks/prompting.md,
 * decision 11): the first paragraph of prose in its AGENTS.md, CLAUDE.md or
 * README, whichever has one first.
 */

/** The files a project's line is read from, in turn. */
export const LINE_FILES = ["AGENTS.md", "CLAUDE.md", "README.md"] as const;

/** The longest line a project gets, in characters. */
export const LINE_MOST = 200;

/** How much of a file is read for its line. */
export const LINE_READ_MOST = 16_384;

const NOT_PROSE = [
  /^#/, // a heading
  /^!?\[!?\[/, // a badge
  /^!\[/, // a picture
  /^</, // HTML
  /^@/, // an import ("@AGENTS.md")
  /^([-*_])\s*\1\s*\1/, // a rule
  /^\|/, // a table
  /^([-*+]|\d+[.)])\s/, // a list item
  /^>/, // a quote
];

/**
 * The first paragraph of prose in a Markdown `text`, its marks taken out
 * and cut at a word near `LINE_MOST`; null when there is none.
 */
export function firstParagraph(text: string): string | null {
  const lines = withoutFrontMatter(text.replace(/<!--[\s\S]*?-->/g, "")).split(/\r?\n/);
  const paragraph: string[] = [];
  let fenced = false;
  for (const raw of lines) {
    const line = raw.trim();
    if (line.startsWith("```") || line.startsWith("~~~")) {
      fenced = !fenced;
      if (paragraph.length > 0) break;
      continue;
    }
    if (fenced) continue;
    const prose = line.length > 0 && !NOT_PROSE.some((mark) => mark.test(line));
    if (prose) paragraph.push(line);
    else if (paragraph.length > 0) break;
  }
  const words = unmarked(paragraph.join(" "));
  return words.length === 0 ? null : cut(words, LINE_MOST);
}

function withoutFrontMatter(text: string): string {
  const match = /^---\r?\n[\s\S]*?\r?\n---\r?\n/.exec(text);
  return match ? text.slice(match[0].length) : text;
}

/** Links to their words, and emphasis and code marks gone. */
function unmarked(text: string): string {
  return text
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/(\*\*|__|\*|_|`)(\S(?:.*?\S)?)\1/g, "$2")
    .replace(/\s+/g, " ")
    .trim();
}

function cut(text: string, most: number): string {
  if (text.length <= most) return text;
  const space = text.lastIndexOf(" ", most - 1);
  return `${text.slice(0, space > most / 2 ? space : most - 1).replace(/[\s,;:.]+$/, "")}…`;
}
