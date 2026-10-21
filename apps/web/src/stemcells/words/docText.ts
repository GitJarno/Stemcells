/**
 * The composer's document as the reader reads it: plain text, one line per
 * block, and where each character sits in the document. The reader works on
 * text; the ink goes back onto the document by these positions.
 *
 * Code (a code block, or an inline code mark in rich text) reads as blank,
 * since it is literal however it was written, and an inline chip (a file,
 * a skill, a citation) is one character no word is made of. A rich-text
 * list item reads with the "- " it was typed or pasted with, so a list
 * reads as a list; those two characters aren't in the document.
 */

import type { Node as DocNode } from "@tiptap/pm/model";

import type { Span } from "./text";

/** A chip in the text: not a word, not a space. */
export const CHIP = "￼";

export interface DocText {
  readonly text: string;
  /** The same text with its code as written, for what is sent. */
  readonly raw: string;
  /** `at[i]` is the document position of character `i`. */
  readonly at: readonly number[];
  /** The characters the document doesn't hold: a list item's "- ". */
  readonly markers: ReadonlySet<number>;
  /** The characters in code, read as blank. */
  readonly code: ReadonlySet<number>;
}

const LIST_ITEM = /^(?:listItem|taskItem|list_item)$/;

export function docText(doc: DocNode): DocText {
  let text = "";
  let raw = "";
  const at: number[] = [];
  const markers = new Set<number>();
  const code = new Set<number>();
  let blocks = 0;
  doc.descendants((node, pos, parent, index) => {
    if (node.isTextblock) {
      if (blocks++ > 0) {
        text += "\n";
        raw += "\n";
        at.push(pos);
      }
      if (index === 0 && parent && LIST_ITEM.test(parent.type.name)) {
        for (const c of "- ") {
          markers.add(text.length);
          text += c;
          raw += c;
          at.push(pos + 1);
        }
      }
      return true;
    }
    if (node.isText) {
      const value = node.text ?? "";
      const literal =
        parent?.type.spec.code === true || node.marks.some((m) => m.type.spec.code === true);
      if (literal) for (let i = 0; i < value.length; i++) code.add(text.length + i);
      text += literal ? value.replace(/[^\n]/g, " ") : value;
      raw += value;
      for (let i = 0; i < value.length; i++) at.push(pos + i);
      return false;
    }
    if (node.isInline) {
      const c = node.type.name === "hardBreak" ? "\n" : CHIP;
      text += c;
      raw += c;
      at.push(pos);
      return false;
    }
    return true;
  });
  return { text, raw, at, markers, code };
}

/** The document range a stretch of the text covers. */
export function rangeOf(doc: DocText, span: Span): { from: number; to: number } {
  return { from: doc.at[span.start]!, to: doc.at[span.end - 1]! + 1 };
}

/** The text offset of a document position: the character at it, or the end. */
export function offsetOf(doc: DocText, pos: number): number {
  let lo = 0;
  let hi = doc.at.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (doc.at[mid]! < pos) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}
