import type { Node as DocNode } from "@tiptap/pm/model";

import { CHIP, type DocText } from "../docText";

/**
 * What a plan was made from: the message as written, code included, and which chip stands at
 * each chip's place. The reader's text blanks code and reads every chip alike, so an edit in
 * code or a swapped chip let a stale plan go out; a plan whose key no longer matches is dropped.
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
