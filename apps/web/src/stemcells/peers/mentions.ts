// Another Cell named in a chat's words becomes a link upstream's markdown keeps,
// `[Manatee](t3-context://v1/stemcells-cell/<thread id>)`, which our renderer draws as
// its token (`CellToken.tsx`; stemcells/tasks/cell-tokens.md). Rewriting the text,
// not the parsed tree, keeps upstream's incremental parse while a reply streams.

/** The context link's kind for another Cell: `t3-context://v1/stemcells-cell/<threadId>`. */
export const CELL_LINK_KIND = "stemcells-cell";

/** What upstream's context links take as an id. */
const LINKABLE_ID = /^[a-z0-9_-]{1,128}$/i;

export interface NamedCell {
  readonly id: string;
  readonly name: string;
  /** Its last activity, as an ISO time. */
  readonly updatedAt: string;
}

/** Each name a chat may use for another Cell, and the chat it means: with two of one name, the one active last. */
export function namesOf(cells: ReadonlyArray<NamedCell>): ReadonlyMap<string, string> {
  const latest = new Map<string, NamedCell>();
  for (const cell of cells) {
    if (!LINKABLE_ID.test(cell.id)) continue;
    const held = latest.get(cell.name);
    if (held === undefined || cell.updatedAt > held.updatedAt) latest.set(cell.name, cell);
  }
  return new Map([...latest].map(([name, cell]) => [name, cell.id]));
}

// Inline code, a link or image with its words, an autolink or a tag, a bare URL: kept as written.
const KEPT = /(`+)[\s\S]*?\1|!?\[[^\]]*\]\([^)]*\)|<[^>\s]+>|https?:\/\/\S+/g;
const FENCE = /^\s*(`{3,}|~{3,})/;
// Four spaces in is code unless it continues a list.
const INDENTED_CODE = /^(?: {4,}|\t)(?!\s*(?:[-*+]|\d+[.)])\s)/;

/** The text with each name in `names` outside code and links written as its Cell's link. */
export function linkCellNames(text: string, names: ReadonlyMap<string, string>): string {
  if (names.size === 0) return text;
  const alternatives = [...names.keys()]
    .toSorted((a, b) => b.length - a.length)
    .map((name) => name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("|");
  // A whole, capitalised word, "@" before it or not; never part of a path, a handle or a longer word.
  const named = new RegExp(
    `(?<![\\p{L}\\p{N}_./#@-])@?(${alternatives})(?![\\p{L}\\p{N}_-])`,
    "gu",
  );
  const link = (line: string) =>
    line.replace(
      named,
      (_whole, name: string) => `[${name}](t3-context://v1/${CELL_LINK_KIND}/${names.get(name)})`,
    );
  let fence: string | null = null;
  return text
    .split("\n")
    .map((line) => {
      const marker = FENCE.exec(line)?.[1];
      if (fence !== null) {
        if (
          marker !== undefined &&
          marker[0] === fence[0] &&
          marker.length >= fence.length &&
          line.trim() === marker
        )
          fence = null;
        return line;
      }
      if (marker !== undefined) {
        fence = marker;
        return line;
      }
      if (INDENTED_CODE.test(line)) return line;
      let out = "";
      let from = 0;
      for (const kept of line.matchAll(KEPT)) {
        out += link(line.slice(from, kept.index)) + kept[0];
        from = kept.index + kept[0].length;
      }
      return out + link(line.slice(from));
    })
    .join("\n");
}
