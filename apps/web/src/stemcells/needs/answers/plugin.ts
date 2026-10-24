/**
 * The answers' ink in Aski's composer, as a ProseMirror plugin: it reads the
 * document against the open cards on every change and marks what it read. A
 * card's number or Cell wears the Cell tone, the words that answer it wear
 * the token plate, and words that answer nothing are dotted, in the warning
 * tone. It never touches the document, so undo and the caret stay upstream's.
 * The composer's own reader (`words/`) reads our parts as blank
 * (`readAnswers(text, openCards()).spans`).
 */
import { closeHistory } from "@tiptap/pm/history";
import type { Node as DocNode } from "@tiptap/pm/model";
import { Plugin, PluginKey, type EditorState } from "@tiptap/pm/state";
import { Decoration, DecorationSet, type EditorView } from "@tiptap/pm/view";

import { promptBetween } from "../../upstream/words";
import { CHIP, type DocText, docText, offsetOf, rangeOf } from "../../words/docText";
import { ghost, wordsKey } from "../../words/plugin";
import type { Span } from "../../words/text";
import { type OptionCompletion, optionCompletionAt } from "./complete";
import { type Addressee, type Answers, readAnswers } from "./read";

export interface AnswersState {
  readonly cards: ReadonlyArray<Addressee>;
  readonly doc: DocNode;
  readonly text: DocText;
  /** The text as the reader reads it: code as a chip. */
  readonly read: string;
  readonly answers: Answers;
  readonly decorations: DecorationSet;
  readonly focused: boolean;
  readonly composing: boolean;
  /** What Tab writes at the caret (`complete.ts`). */
  readonly offer: (OptionCompletion & { readonly pos: number }) | null;
}

type Meta = true | { readonly focused?: boolean; readonly composing?: boolean };

export const answersKey = new PluginKey<AnswersState>("stemcells-answers");

/** What the composer's words answer, as last read. */
export function answersOf(state: EditorState): AnswersState | null {
  return answersKey.getState(state) ?? null;
}

/** Reads again: the cards changed. */
export function refreshAnswers(view: EditorView): void {
  view.dispatch(view.state.tr.setMeta(answersKey, true).setMeta("addToHistory", false));
}

/**
 * What a document's words answer. Code reads as a chip does, something
 * said whose words aren't read, so a reply keeps it to its edges; and the
 * words a Cell is sent are the composer's own prompt for them, a chip as
 * what it stands for and code in its backticks, never a blank or "￼".
 */
export function readDoc(
  doc: DocNode,
  cards: ReadonlyArray<Addressee>,
): { readonly text: DocText; readonly read: string; readonly answers: Answers } {
  const text = docText(doc);
  let read = "";
  for (let i = 0; i < text.text.length; i++)
    read += text.code.has(i) && text.text[i] !== "\n" ? CHIP : text.text[i];
  const sent = (span: Span) => {
    if (span.end <= span.start) return "";
    const { from, to } = rangeOf(text, span);
    return promptBetween(doc, from, to);
  };
  return { text, read, answers: readAnswers(read, cards, sent) };
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
  const reread = (prev: AnswersState | null, state: EditorState, refresh: boolean) => {
    const now = cards();
    if (prev !== null && prev.doc === state.doc && prev.cards === now && !refresh) return prev;
    const { text, read, answers } = readDoc(state.doc, now);
    return {
      cards: now,
      doc: state.doc,
      text,
      read,
      answers,
      decorations: DecorationSet.create(state.doc, inkOf(answers, text)),
      focused: prev?.focused ?? false,
      composing: prev?.composing ?? false,
      offer: null,
    };
  };
  const withOffer = (read: AnswersState, state: EditorState): AnswersState => {
    const { selection } = state;
    const completion =
      read.focused && !read.composing && selection.empty
        ? optionCompletionAt(read.read, offsetOf(read.text, selection.from), read.cards)
        : null;
    return { ...read, offer: completion && { ...completion, pos: selection.from } };
  };
  const tell = (view: EditorView, meta: Meta) =>
    view.dispatch(view.state.tr.setMeta(answersKey, meta).setMeta("addToHistory", false));

  return new Plugin<AnswersState>({
    key: answersKey,
    state: {
      init: (_, state) => reread(null, state, false),
      apply: (tr, prev, _old, state) => {
        const meta = tr.getMeta(answersKey) as Meta | undefined;
        if (!tr.docChanged && !tr.selectionSet && meta === undefined) return prev;
        const read = reread(prev, state, meta === true);
        return withOffer(typeof meta === "object" ? { ...read, ...meta } : read, state);
      },
    },
    view: (view) => {
      // The words may already be there when the plugin joins, and the focus.
      onChange(view);
      const settle = setTimeout(() => {
        if (!view.isDestroyed && view.hasFocus()) tell(view, { focused: true });
      });
      return {
        update: (updated, previous) => {
          if (
            answersKey.getState(previous)?.answers !== answersKey.getState(updated.state)?.answers
          )
            onChange(updated);
        },
        destroy: () => clearTimeout(settle),
      };
    },
    props: {
      // The ink's styles are the composer's words' (`words/words.css`).
      attributes: { "data-stemcells-words": "", "data-stemcells-answers": "" },
      decorations: (state) => {
        const own = answersKey.getState(state);
        const offer = ownOffer(state);
        if (own === undefined || offer === null) return own?.decorations ?? null;
        return own.decorations.add(state.doc, [
          Decoration.widget(offer.pos, () => ghost(offer.rest), {
            side: 1,
            key: `sc-answer-ghost:${offer.rest}`,
            ignoreSelection: true,
          }),
        ]);
      },
      handleKeyDown: (view, event) => {
        if (event.key !== "Tab" || event.shiftKey || event.altKey || event.metaKey) return false;
        if (event.ctrlKey || event.isComposing) return false;
        const offer = ownOffer(view.state);
        if (offer === null) return false;
        event.preventDefault();
        const insert = offer.rest + (offer.words ? " " : "");
        view.dispatch(closeHistory(view.state.tr.insertText(insert, offer.pos)).scrollIntoView());
        return true;
      },
      handleDOMEvents: {
        focus: (view) => {
          tell(view, { focused: true });
          return false;
        },
        blur: (view) => {
          tell(view, { focused: false });
          return false;
        },
        compositionstart: (view) => {
          tell(view, { composing: true });
          return false;
        },
        compositionend: (view) => {
          tell(view, { composing: false });
          return false;
        },
      },
    },
  });
}

/** Our offer, unless the composer's words offer a project's name at the caret: that one has Tab. */
function ownOffer(state: EditorState): AnswersState["offer"] {
  if (wordsKey.getState(state)?.offer) return null;
  return answersKey.getState(state)?.offer ?? null;
}
