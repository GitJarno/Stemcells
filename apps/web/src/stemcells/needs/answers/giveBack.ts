/**
 * An unsent answer's words, back in Aski's composer (stemcells/tasks/aski-answers.md), each on
 * its own line so no reply takes the next one's words. It comes back as "for 3 …" only while 3
 * is still its card and reads as the same answer; else as "Pip › no", which answers no card,
 * since numbers restart and names repeat. Chips, code and line breaks come back as they were.
 */
import { Fragment, type Node as PmNode, type Schema } from "@tiptap/pm/model";
import type { EditorState, Transaction } from "@tiptap/pm/state";

import { type DocText, offsetOf, rangeOf } from "../../words/docText";
import type { Span } from "../../words/text";
import type { Shown } from "../display";
import type { Sent } from "./enter";
import { readDoc } from "./plugin";
import type { Addressee } from "./read";

/** A node as ProseMirror writes it out: data, so it comes back in whichever editor is there. */
interface NodeJson {
  readonly type: string;
  readonly marks?: ReadonlyArray<{ readonly type: string }>;
}

/** What an answer read from words keeps of them, for if nothing is sent. */
export interface Spoken {
  /** The need it answered. */
  readonly key: string;
  /** The card's number when the words were said. */
  readonly number: number;
  /** Who the card was for, as it showed. */
  readonly who: string;
  /** What the words chose: coming back with the number, they must choose it again. */
  readonly chose: string;
  /** The words after the card's number, a line each, as the document held them. */
  readonly lines: ReadonlyArray<ReadonlyArray<NodeJson>>;
}

/** What a reading chooses, to tell one answer from another. */
export function choiceOf(reading: Sent): string {
  return reading.kind === "answer"
    ? `answer ${JSON.stringify(reading.answers)}`
    : `option ${reading.option.id} ${reading.words ?? ""}`;
}

/**
 * What an answer keeps of the words in `said`, from the document `text` was
 * read from; null when no words said it ("ok the rest"): none come back.
 */
export function spokenOf(
  doc: PmNode,
  text: DocText,
  answer: { readonly number: number; readonly reading: Sent; readonly said: Span },
  need: { readonly key: string; readonly who: string },
): Spoken | null {
  if (answer.said.end <= answer.said.start) return null;
  const lines: NodeJson[][] = [];
  const { from, to } = rangeOf(text, answer.said);
  doc.nodesBetween(from, to, (node, pos) => {
    if (!node.isTextblock) return true;
    const start = pos + 1;
    const line = node.content.cut(
      Math.max(from, start) - start,
      Math.min(to - start, node.content.size),
    );
    lines.push((line.toJSON() as NodeJson[] | null) ?? []);
    return false;
  });
  return {
    key: need.key,
    number: answer.number,
    who: need.who,
    chose: choiceOf(answer.reading),
    lines,
  };
}

/**
 * The words back at the end of the composer: under their card's number
 * while it is still theirs on the live list `here` and they answer it as
 * before; else after who they were for. `cards` are what the reader reads.
 */
export function giveBack(
  state: EditorState,
  spoken: Spoken,
  here: ReadonlyArray<Shown>,
  cards: ReadonlyArray<Addressee>,
): Transaction {
  const own = here.some(
    ({ need, goneAt }) =>
      goneAt === null && need.number === spoken.number && need.key === spoken.key,
  );
  if (own) {
    const addressed = put(state, spoken, `for ${spoken.number} `);
    if (answersAgain(addressed, spoken, cards)) return addressed.tr;
  }
  return put(state, spoken, `${spoken.who} › `).tr;
}

/** The words on lines of their own at the end, `lead` first; `at` is where they start. */
function put(
  state: EditorState,
  spoken: Spoken,
  lead: string,
): { readonly tr: Transaction; readonly at: number } {
  const { doc, schema } = state;
  const paragraph = schema.nodes.paragraph!;
  const lines = spoken.lines.map((line) => inline(schema, line));
  const blocks = [
    Fragment.from(schema.text(lead)).append(lines[0] ?? Fragment.empty),
    ...lines.slice(1),
  ].map((content) => paragraph.createChecked(null, content));
  const last = doc.lastChild;
  // An empty composer, or an empty last line, takes them where it is.
  if (last !== null && last.type === paragraph && last.content.size === 0) {
    const at = doc.content.size - last.nodeSize;
    return { tr: state.tr.replaceWith(at, doc.content.size, blocks), at: at + 1 };
  }
  return { tr: state.tr.insert(doc.content.size, blocks), at: doc.content.size + 1 };
}

/** A line's nodes in this editor's schema, without a mark or node it doesn't have. */
function inline(schema: Schema, line: ReadonlyArray<NodeJson>): Fragment {
  return Fragment.fromArray(
    line.flatMap((json) =>
      schema.nodes[json.type] === undefined
        ? []
        : [
            schema.nodeFromJSON({
              ...json,
              marks: json.marks?.filter((mark) => schema.marks[mark.type] !== undefined),
            }),
          ],
    ),
  );
}

/** Whether the words from `at` to the end read as the one answer they gave, to their card. */
function answersAgain(
  given: { readonly tr: Transaction; readonly at: number },
  spoken: Spoken,
  cards: ReadonlyArray<Addressee>,
): boolean {
  // Read as the composer reads it, so a chip or code says what it said.
  const { text, answers } = readDoc(given.tr.doc, cards);
  const start = offsetOf(text, given.at);
  const part = answers.parts.find((each) => each.start === start);
  const target = part?.targets.length === 1 ? part.targets[0]! : null;
  return (
    target !== null &&
    part!.end === text.text.length &&
    target.number === spoken.number &&
    (target.reading.kind === "option" || target.reading.kind === "answer") &&
    choiceOf(target.reading) === spoken.chose
  );
}
