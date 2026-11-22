// The prose of a chat's markdown: what a link may be written into. Code (fenced, indented or
// inline), a link or image with its words, an autolink or a tag, and a bare URL stay as written.
// Rewriting the text, not the parsed tree, keeps upstream's incremental parse while a reply
// streams, on the Mac and the phone alike.

const KEPT = /(`+)[\s\S]*?\1|!?\[[^\]]*\]\([^)]*\)|<[^>\s]+>|https?:\/\/\S+/g;
const FENCE = /^\s*(`{3,}|~{3,})/;
// Four spaces in is code unless it continues a list.
const INDENTED_CODE = /^(?: {4,}|\t)(?!\s*(?:[-*+]|\d+[.)])\s)/;

/** The text with `rewrite` applied to each run of prose, line by line; all else as written. */
export function mapProse(text: string, rewrite: (prose: string) => string): string {
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
        out += rewrite(line.slice(from, kept.index)) + kept[0];
        from = kept.index + kept[0].length;
      }
      return out + rewrite(line.slice(from));
    })
    .join("\n");
}
