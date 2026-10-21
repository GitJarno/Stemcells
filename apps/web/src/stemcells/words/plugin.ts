/**
 * The composer's ink, as a ProseMirror plugin: it reads the document on
 * every change and decorates the words that set something up. It never
 * touches the document, so undo, selection and what the composer sends
 * stay upstream's. Tab writes a completion, as one undo step.
 *
 * A word blooms once in the accent when it is first read, and a word that
 * only moves (text typed before it) keeps its bloom's age, so nothing
 * flashes twice. `stemcells/tasks/prompting.md`, decisions 4 and 7.
 */

import type { Node as DocNode } from "@tiptap/pm/model";
import { closeHistory } from "@tiptap/pm/history";
import { Plugin, PluginKey, type EditorState, type Transaction } from "@tiptap/pm/state";
import { Decoration, DecorationSet, type EditorView } from "@tiptap/pm/view";

import { type Completion, completionAt } from "./completion";
import { type DocText, docText, offsetOf, rangeOf } from "./docText";
import { type InkKind, inkOf } from "./ink";
import type { RosterPlace } from "./places";
import { type Facts, type ReadContext, leadOf, readWords } from "./read";

/** How long a newly read word blooms, in ms; `words.css` runs the bloom. */
export const BLOOM_MS = 600;

/** What the composer reads with. Null where it reads nothing. */
export interface WordsSetting {
  readonly ctx: ReadContext;
  /** Whether a provider can start a Cell now; a model of one that can't is marked. */
  readonly ready: (providerId: string) => boolean;
  /** When a project was last used: completion offers the most recent first. */
  readonly recency: (place: RosterPlace) => number;
}

interface Placed {
  readonly kind: InkKind;
  readonly warn: boolean;
  readonly from: number;
  readonly to: number;
}

interface WordsState {
  readonly setting: WordsSetting | null;
  readonly doc: DocNode | null;
  readonly text: DocText | null;
  readonly facts: Facts | null;
  readonly marks: readonly Placed[];
  /** When each mark was first read, by `kind:from`. */
  readonly born: ReadonlyMap<string, number>;
  readonly focused: boolean;
  readonly composing: boolean;
  readonly offer: (Completion & { readonly pos: number }) | null;
  readonly decorations: DecorationSet;
}

interface WordsMeta {
  readonly refresh?: true;
  readonly focused?: boolean;
  readonly composing?: boolean;
}

export const wordsKey = new PluginKey<WordsState>("stemcells-words");

const keyOf = (m: { kind: InkKind; from: number }) => `${m.kind}:${m.from}`;

/** The plugin's reading of the facts, for what draws beside the composer (its readout, its menus). */
export function wordsFacts(state: EditorState): Facts | null {
  return wordsKey.getState(state)?.facts ?? null;
}

/** Re-reads with the setting `source` gives now: after a project, a model or a provider changes. */
export function refreshWords(view: EditorView): void {
  view.dispatch(view.state.tr.setMeta(wordsKey, { refresh: true }).setMeta("addToHistory", false));
}

export function wordsPlugin(source: () => WordsSetting | null, now = () => performance.now()) {
  const next = (
    prev: WordsState | null,
    state: EditorState,
    tr: Transaction | null,
    meta: WordsMeta | undefined,
  ): WordsState => {
    const setting = source();
    const focused = meta?.focused ?? prev?.focused ?? false;
    const composing = meta?.composing ?? prev?.composing ?? false;
    const reread =
      prev === null || prev.doc !== state.doc || prev.setting !== setting || meta?.refresh === true;
    const text = reread ? (setting ? docText(state.doc) : null) : prev.text;
    const facts = reread
      ? setting && text
        ? readWords(text.text, setting.ctx)
        : null
      : prev.facts;

    let marks: readonly Placed[] = prev?.marks ?? [];
    let born: ReadonlyMap<string, number> = prev?.born ?? new Map();
    if (reread) {
      marks =
        facts && text && setting
          ? inkOf(facts, setting.ready).map((m) => ({
              kind: m.kind,
              warn: m.warn,
              ...rangeOf(text, m),
            }))
          : [];
      // The first reading of a document is what was already there: it
      // doesn't bloom. After that, a mark blooms when it is new.
      const first = prev?.facts == null;
      const moved = new Map<string, number>();
      for (const [key, at] of born) {
        const [kind, from] = key.split(":");
        const pos = tr ? tr.mapping.map(Number(from), 1) : Number(from);
        moved.set(`${kind}:${pos}`, at);
      }
      const t = now();
      born = new Map(marks.map((m) => [keyOf(m), moved.get(keyOf(m)) ?? (first ? -Infinity : t)]));
    }

    const { selection } = state;
    const completion =
      setting && text && focused && !composing && selection.empty
        ? completionAt(
            text.text,
            offsetOf(text, selection.from),
            setting.ctx.roster,
            leadOf(setting.ctx.models),
            setting.recency,
          )
        : null;
    const offer = completion ? { ...completion, pos: selection.from } : null;

    const t = now();
    const decorations = DecorationSet.create(state.doc, [
      ...marks.map((m) => {
        const age = t - (born.get(keyOf(m)) ?? -Infinity);
        const caught = age < BLOOM_MS && m.kind !== "quiet";
        // A project's or a model's name is no typo: no spelling marks on it.
        return Decoration.inline(m.from, m.to, {
          spellcheck: "false",
          class: [
            m.kind === "quiet" ? "sc-word-quiet" : `sc-word sc-word-${m.kind}`,
            m.warn ? "sc-word-warn" : "",
            caught ? "sc-word-caught" : "",
          ]
            .filter(Boolean)
            .join(" "),
          ...(caught ? { style: `animation-delay: ${-Math.round(age)}ms` } : {}),
        });
      }),
      ...(offer
        ? [
            Decoration.widget(offer.pos, () => ghost(offer.rest), {
              side: 1,
              key: `sc-word-ghost:${offer.rest}`,
              ignoreSelection: true,
            }),
          ]
        : []),
    ]);
    return {
      setting,
      doc: state.doc,
      text,
      facts,
      marks,
      born,
      focused,
      composing,
      offer,
      decorations,
    };
  };

  const tell = (view: EditorView, meta: WordsMeta) =>
    view.dispatch(view.state.tr.setMeta(wordsKey, meta).setMeta("addToHistory", false));

  return new Plugin<WordsState>({
    key: wordsKey,
    state: {
      init: (_, state) => next(null, state, null, undefined),
      apply: (tr, prev, _old, state) => {
        const meta = tr.getMeta(wordsKey) as WordsMeta | undefined;
        if (!tr.docChanged && !tr.selectionSet && meta === undefined) return prev;
        return next(prev, state, tr, meta);
      },
    },
    view: (view) => {
      // The plugin may join an editor that already has the focus.
      const settle = setTimeout(() => {
        if (!view.isDestroyed && view.hasFocus()) tell(view, { focused: true });
      });
      return { destroy: () => clearTimeout(settle) };
    },
    props: {
      attributes: { "data-stemcells-words": "" },
      decorations: (state) => wordsKey.getState(state)?.decorations ?? null,
      handleKeyDown: (view, event) => {
        if (event.key !== "Tab" || event.shiftKey || event.altKey || event.metaKey) return false;
        if (event.ctrlKey || event.isComposing) return false;
        const offer = wordsKey.getState(view.state)?.offer;
        if (!offer) return false;
        const after = view.state.doc.textBetween(
          offer.pos,
          Math.min(offer.pos + 1, view.state.doc.content.size),
          "\n",
        );
        const insert = offer.rest + (after === "" || !/\s/.test(after) ? " " : "");
        event.preventDefault();
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

/** The rest of a name, as a ghost after the caret, with the key that writes it. */
function ghost(rest: string): HTMLElement {
  const el = document.createElement("span");
  el.className = "sc-word-ghost";
  el.contentEditable = "false";
  el.setAttribute("aria-hidden", "true");
  el.textContent = rest;
  const key = document.createElement("span");
  key.className = "sc-word-ghost-key";
  key.textContent = "⇥";
  el.append(key);
  return el;
}
