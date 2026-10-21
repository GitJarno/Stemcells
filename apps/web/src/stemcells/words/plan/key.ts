import type { Node as DocNode } from "@tiptap/pm/model";

import { CHIP, type DocText } from "../docText";

/**
 * What a plan was made from: the message as written, its code too, and
 * which chip stands at each chip's place. The reader's text blanks code
 * and reads every chip alike, so an edit inside code, or one chip swapped
 * for another, left it the same and a stale plan went out; this key
 * changes with them, and a plan whose key no longer matches is dropped.
 */
export function planKeyOf(doc: DocNode, text: DocText): string {
  const chips: string[] = [];
  for (let i = 0; i < text.raw.length; i++) {
    if (text.raw[i] !== CHIP) continue;
    const node = doc.nodeAt(text.at[i]!);
    chips.push(node ? `${node.type.name}:${JSON.stringify(node.attrs)}` : "");
  }
  return JSON.stringify([text.raw, chips]);
}
