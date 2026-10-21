/**
 * The answers' ink in Aski's composer, as a ProseMirror plugin: it reads the
 * document against the open cards on every change and marks what it read. A
 * card's number or Cell wears the Cell tone, the words that answer it wear
 * the token plate, and words that answer nothing are dotted, in the warning
 * tone. It never touches the document, so undo and the caret stay upstream's.
 * The composer's own reader (`words/`) reads our parts as blank
 * (`readAnswers(text, openCards()).spans`).
 */
import type { Node as DocNode } from "@tiptap/pm/model";
import { Plugin, PluginKey, type EditorState } from "@tiptap/pm/state";
import { Decoration, DecorationSet, type EditorView } from "@tiptap/pm/view";

import { type DocText, docText, rangeOf } from "../../words/docText";
import type { Span } from "../../words/text";
import { type Addressee, type Answers, readAnswers } from "./read";

export interface AnswersState {
  readonly cards: ReadonlyArray<Addressee>;
  readonly doc: DocNode;
  readonly text: DocText;
  readonly answers: Answers;
  readonly decorations: DecorationSet;
}

export const answersKey = new PluginKey<AnswersState>("stemcells-answers");

/** What the composer's words answer, as last read. */
export function answersOf(state: EditorState): AnswersState | null {
  return answersKey.getState(state) ?? null;
}

/** Reads again: the cards changed. */
export function refreshAnswers(view: EditorView): void {
  view.dispatch(view.state.tr.setMeta(answersKey, true).setMeta("addToHistory", false));
}

/** Whether a part leaves words that answer nothing. */
function unresolved(part: Answers["parts"][number]): boolean {
  return (
    part.missing !== null ||
    part.targets.some((t) => t.reading.kind === "kept" || t.reading.kind === "words")
  );
}

function inkOf(answers: Answers, text: DocText): Decoration[] {
  const marks: Decoration[] = [];
  const mark = (span: Span, className: string) => {
    if (span.end <= span.start) return;
    const { from, to } = rangeOf(text, span);
    // A Cell's name is no typo.
    marks.push(Decoration.inline(from, to, { class: className, spellcheck: "false" }));
  };
  for (const part of answers.parts) {
    const open = unresolved(part);
    mark(part.anchor, part.missing === null ? "sc-word sc-word-cell" : "sc-answer-kept");
    if (part.form !== null) mark(part.form, "sc-word");
    if (open) {
      const from = Math.max(part.anchor.end, part.form?.end ?? 0);
      const lead = /^[\s,.;:—–-]*/.exec(text.text.slice(from, part.end))![0].length;
      mark({ start: from + lead, end: part.end }, "sc-answer-kept");
    }
  }
  return marks;
}

export function answersPlugin(
  cards: () => ReadonlyArray<Addressee>,
  onChange: (view: EditorView) => void,
) {
  const next = (prev: AnswersState | null, state: EditorState, refresh: boolean): AnswersState => {
    const now = cards();
    if (prev !== null && prev.doc === state.doc && prev.cards === now && !refresh) return prev;
    const text = docText(state.doc);
    const answers = readAnswers(text.text, now);
    return {
      cards: now,
      doc: state.doc,
      text,
      answers,
      decorations: DecorationSet.create(state.doc, inkOf(answers, text)),
    };
  };
  return new Plugin<AnswersState>({
    key: answersKey,
    state: {
      init: (_, state) => next(null, state, false),
      apply: (tr, prev, _old, state) =>
        tr.docChanged || tr.getMeta(answersKey) === true
          ? next(prev, state, tr.getMeta(answersKey) === true)
          : prev,
    },
    view: (view) => {
      // The words may already be there when the plugin joins.
      onChange(view);
      return {
        update: (updated, previous) => {
          if (
            answersKey.getState(previous)?.answers !== answersKey.getState(updated.state)?.answers
          )
            onChange(updated);
        },
      };
    },
    props: {
      // The ink's styles are the composer's words' (`words/words.css`).
      attributes: { "data-stemcells-words": "", "data-stemcells-answers": "" },
      decorations: (state) => answersKey.getState(state)?.decorations ?? null,
    },
  });
}
