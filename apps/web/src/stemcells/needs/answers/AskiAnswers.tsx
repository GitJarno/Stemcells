import type { Editor, TiptapEditorHTMLElement } from "@tiptap/core";
import type { Node as PmNode } from "@tiptap/pm/model";
import type { EditorView } from "@tiptap/pm/view";
import { use, useEffect, useLayoutEffect, useRef, useSyncExternalStore } from "react";

import { useNowMinuteMs, useOpenFromNeeds } from "../../upstream/needs";
import type { DocText } from "../../words/docText";
import { type BeforeSend, WordsSendSlot } from "../../words/send";
import type { Span } from "../../words/text";
import { commandsFor } from "../actions";
import { useHolds } from "../holds";
import { holds, page } from "../live";
import { whoOf } from "../NeedCard";
import type { Need } from "../wire";
import { addresseesOf } from "./cards";
import { type Enter, enterOf } from "./enter";
import { giveBack, spokenOf } from "./giveBack";
import { readingLine } from "./line";
import { type Lit, lit } from "./lit";
import { type AnswersState, answersKey, answersOf, answersPlugin, refreshAnswers } from "./plugin";
import type { Addressee, Answers } from "./read";
import { AnswersRoom, type ReadoutPart, type ShownAnswers } from "./room";

/**
 * Words in Aski's composer answer the cards beside it (stemcells/tasks/
 * aski-room.md, decision 8). Mounted with every composer's editor; only Aski's
 * (`AnswersRoom`) reads anything.
 */
export function AskiAnswers(props: { readonly anchor: string }) {
  const room = use(AnswersRoom);
  return room === null ? null : <Answering anchor={props.anchor} show={room} />;
}

function Answering(props: {
  readonly anchor: string;
  readonly show: (shown: ShownAnswers | null) => void;
}) {
  const { show } = props;
  const sendSlot = use(WordsSendSlot);
  const open = useOpenFromNeeds();
  const view = useSyncExternalStore(page.subscribe, page.read, page.read);
  const held = useHolds(holds);
  const now = useNowMinuteMs();
  const cards = addresseesOf(view.shown, held, now);
  const needs = useRef<ReadonlyMap<number, Need>>(new Map());
  const current = useRef(cards);
  const joined = useRef<Editor | null>(null);
  // A message to Aski on its way: upstream puts a failed one back only into
  // an empty composer, so no words come back until it settles.
  const sending = useRef(false);

  /** What the words do now: the readout, and each card's light. */
  const publish = (editorView: EditorView) => {
    const state = answersOf(editorView.state);
    const answers = state?.answers ?? null;
    show(answers === null || answers.parts.length === 0 ? null : readoutOf(answers, state!.cards));
    lit.show(answers === null ? new Map() : litOf(answers, needs.current));
  };

  // oxlint-disable-next-line t3code/react-effect-budget -- Hand the editor plugin the newest cards before paint and re-read the composer against them.
  useLayoutEffect(() => {
    current.current = cards;
    // The live card holds its number over one still leaving (`read.ts`).
    needs.current = new Map(
      view.shown
        .toSorted((a, b) => Number(a.goneAt === null) - Number(b.goneAt === null))
        .map(({ need }) => [need.number, need]),
    );
    const editor = joined.current;
    if (editor && !editor.isDestroyed) refreshAnswers(editor.view);
  }, [cards, view.shown]);

  // The editor remounts when its chat or its text mode changes, so every
  // render looks for the one wearing the anchor now.
  // oxlint-disable-next-line t3code/react-effect-budget -- Join the answers plugin to the composer's editor, which remounts outside this component.
  useEffect(() => {
    const element = document.querySelector<TiptapEditorHTMLElement>(`.${props.anchor}`);
    const editor = element?.editor ?? null;
    if (editor !== null && editor === joined.current && !editor.isDestroyed) return;
    leave(joined.current, show);
    joined.current = null;
    if (editor === null || editor.isDestroyed) return;
    editor.registerPlugin(
      answersPlugin(() => current.current, publish),
      (plugin, plugins) => [plugin, ...plugins],
    );
    joined.current = editor;
  });
  // An answer that wasn't sent gives its words back to the composer, once:
  // when the composer has joined, the list is live (a number names nothing
  // until it is) and no message to Aski is on its way. Until then they wait
  // in their hold, which stays for them.
  const giveBackWaiting = () => {
    const editor = joined.current;
    const { shown, live } = page.read();
    if (editor === null || editor.isDestroyed || !live || sending.current) return;
    for (const hold of holds.read().values()) {
      const spoken = hold.words === null ? null : holds.takeWords(hold.key);
      if (spoken !== null)
        editor.view.dispatch(giveBack(editor.view.state, spoken, shown, current.current));
    }
  };
  // oxlint-disable-next-line t3code/react-effect-budget -- Give unsent answers' words back to the composer once it has joined and the list is live.
  useEffect(giveBackWaiting);
  // oxlint-disable-next-line t3code/react-effect-budget -- Detach the answers plugin from the composer when `show` changes or this unmounts.
  useEffect(
    () => () => {
      leave(joined.current, show);
      joined.current = null;
    },
    [show],
  );

  // Enter: answers into their holds, clicks lit on their cards, and the
  // words that answered nothing kept in the composer; the rest goes to Aski.
  // oxlint-disable-next-line t3code/react-effect-budget -- Register the composer's before-send hook for answers, and unregister it on each change.
  useEffect(() => {
    if (sendSlot === null) return;
    const beforeSend: BeforeSend = () => {
      const editor = joined.current;
      const state = editor && !editor.isDestroyed ? answersOf(editor.view.state) : null;
      const enter = state ? enterOf(state.answers, state.text.raw) : null;
      if (!editor || !state || !enter) return null;
      act(enter, state, needs.current, (threadId) => open.chat(threadId));
      const editorView = editor.view;
      if (enter.rest.length === 0) {
        keepOnly(editorView, state.text, enter.keep);
        return { hold: true, ready: null, foreground: false, edit: () => null };
      }
      const edit = () => {
        const before = editorView.state.doc;
        keepOnly(editorView, state.text, enter.rest);
        const sent = editorView.state.doc;
        sending.current = true;
        return (result: unknown) => {
          void Promise.resolve(result)
            .catch(() => undefined)
            .then(() => {
              sending.current = false;
              if (editorView.isDestroyed) return;
              // Nothing went: the words for Aski come back with what was kept.
              if (editorView.state.doc.eq(sent)) {
                putBack(editorView, before);
                keepOnly(editorView, state.text, [...enter.rest, ...enter.keep]);
              } else if (enter.keep.length > 0) {
                const kept = enter.keep.map((span) => state.text.raw.slice(span.start, span.end));
                editorView.dispatch(editorView.state.tr.insertText(kept.join(" ")));
              }
            })
            .finally(giveBackWaiting);
        };
      };
      return { hold: false, ready: null, foreground: false, edit };
    };
    return sendSlot("answers", beforeSend);
  });

  return null;
}

/** Each answer into its card's hold, with its words; each click asked for on its card. */
function act(
  enter: Enter,
  state: AnswersState,
  needs: ReadonlyMap<number, Need>,
  openChat: (threadId: string) => void,
): void {
  const now = Date.now();
  for (const answer of enter.answers) {
    const { number, reading } = answer;
    const need = needs.get(number);
    if (need === undefined) continue;
    const words = spokenOf(state.doc, state.text, answer, { key: need.key, who: whoOf(need) });
    if (reading.kind === "answer") {
      holds.hold({
        key: need.key,
        threadId: need.threadId,
        commands: commandsFor(need, { kind: "answer" }, { answers: reading.answers }, now),
        words,
      });
      continue;
    }
    const given = reading.words === null ? {} : { words: reading.words };
    holds.hold({
      key: need.key,
      threadId: need.threadId,
      commands: commandsFor(need, reading.option.choice, given, now),
      words,
    });
  }
  for (const number of enter.opens) {
    const need = needs.get(number);
    if (need !== undefined) openChat(need.threadId);
  }
  lit.ask(
    enter.clicks.flatMap(({ number, option }) => {
      const need = needs.get(number);
      return need === undefined ? [] : [[need.key, option.id] as const];
    }),
  );
}

/** The readout: each card's part, answers first, then the words for Aski. */
function readoutOf(answers: Answers, cards: ReadonlyArray<Addressee>): ShownAnswers {
  const parts = answers.parts.flatMap((part, index): ReadoutPart[] => {
    if (part.missing !== null)
      return [
        {
          key: `${index}:missing`,
          number: null,
          who: null,
          what: `no card ${part.missing}`,
          tone: "kept",
        },
      ];
    return part.targets.flatMap((target) => {
      const card = cards.find((each) => each.number === target.number);
      if (card === undefined) return [];
      const { kind } = target.reading;
      return [
        {
          key: `${index}:${target.number}`,
          number: card.number,
          who: card.who,
          what: readingLine(target.reading, card),
          tone:
            kind === "click" ? "click" : kind === "kept" || kind === "words" ? "kept" : "answer",
        },
      ];
    });
  });
  const order = (part: ReadoutPart) => (part.tone === "answer" ? 0 : part.tone === "click" ? 1 : 2);
  return { parts: parts.toSorted((a, b) => order(a) - order(b)), rest: answers.rest.length > 0 };
}

/** Each card's light, by need key. */
function litOf(answers: Answers, needs: ReadonlyMap<number, Need>): ReadonlyMap<string, Lit> {
  const out = new Map<string, Lit>();
  for (const part of answers.parts) {
    for (const { number, reading } of part.targets) {
      const key = needs.get(number)?.key;
      if (key === undefined || out.has(key)) continue;
      if (reading.kind === "option")
        out.set(key, { kind: "chosen", id: reading.option.id, words: reading.words });
      else if (reading.kind === "answer")
        out.set(key, {
          kind: "chosen",
          id: reading.pick === null ? "other" : `answer:${reading.pick}`,
          // A custom answer's label is its words in quotes.
          words: reading.pick === null ? reading.label.slice(1, -1) : null,
        });
      else if (reading.kind === "click") out.set(key, { kind: "click", id: reading.option.id });
      else if (reading.kind === "words") out.set(key, { kind: "words", id: reading.option.id });
    }
  }
  return out;
}

/** Leaves only these stretches of the text in the composer, a space between each. */
function keepOnly(view: EditorView, text: DocText, keep: ReadonlyArray<Span>): void {
  const spans = keep.toSorted((a, b) => a.start - b.start);
  const at = (offset: number) =>
    offset < text.at.length ? text.at[offset]! : view.state.doc.content.size - 1;
  let tr = view.state.tr;
  // From the end, so earlier positions hold.
  const gaps: Array<{ readonly start: number; readonly end: number; readonly join: boolean }> = [];
  let from = 0;
  spans.forEach((span, index) => {
    gaps.push({ start: from, end: span.start, join: index > 0 });
    from = span.end;
  });
  gaps.push({ start: from, end: text.text.length, join: false });
  for (const gap of gaps.toReversed()) {
    if (gap.end <= gap.start) continue;
    const range = { from: at(gap.start), to: at(gap.end - 1) + 1 };
    tr = gap.join ? tr.insertText(" ", range.from, range.to) : tr.delete(range.from, range.to);
  }
  view.dispatch(tr);
}

/** The document as it was before the send. */
function putBack(view: EditorView, before: PmNode): void {
  view.dispatch(
    view.state.tr
      .replaceWith(0, view.state.doc.content.size, before.content)
      .setMeta("addToHistory", false),
  );
}

function leave(editor: Editor | null, show: (shown: ShownAnswers | null) => void): void {
  show(null);
  lit.show(new Map());
  if (editor === null || editor.isDestroyed) return;
  editor.unregisterPlugin(answersKey);
}
