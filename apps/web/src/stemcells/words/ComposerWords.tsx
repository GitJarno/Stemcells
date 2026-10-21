import type { Editor, TiptapEditorHTMLElement } from "@tiptap/core";
import type { EditorView } from "@tiptap/pm/view";
import { use, useEffect, useId, useLayoutEffect, useRef, useState } from "react";

import { PaneCellContext } from "../tabs/paneCell";
import {
  isDraftGone,
  moveDraft,
  readDraftModel,
  readDraftProjectKey,
} from "../upstream/draftWords";
import { ProviderLogo } from "../upstream/providers";
import { useWordsCatalog, useWordsDraft, useWordsPlaces } from "../upstream/words";
import { modelLexicon, type WordsCatalog } from "./catalog";
import { rangeOf } from "./docText";
import { type DriverSource, WordsDriver } from "./driver";
import { type MenuAction, type MenuEntry, menuFor } from "./menu";
import { roster, type WordsPlace } from "./places";
import { type Placed, refreshWords, type WordsSetting, wordsKey, wordsPlugin } from "./plugin";
import type { ReadContext } from "./read";
import { type BeforeSend, editsToward, outgoingOf, WordsSendSlot } from "./send";
import { TokenMenu, type TokenMenuAt } from "./TokenMenu";
import "../tokens/stemcells.css";
import "./words.css";

/** A class only this composer's editor wears, so the words can find it. */
export function useWordsAnchor(): string {
  return `sc-words-${useId().replace(/[^\w-]/g, "")}`;
}

interface OpenMenu {
  readonly mark: Placed;
  readonly at: TokenMenuAt;
  readonly entries: ReadonlyArray<MenuEntry & { readonly pick: () => void }>;
}

/**
 * The composer reads what is typed into a new chat. It joins the editor
 * that wears `anchor` with the ink plugin, keeps the draft in step with
 * the words (`driver.ts`), opens a read word's menu, and makes the text
 * what is sent (`send.ts`). It draws only the menu. A sent chat's
 * composer reads nothing: its words set nothing up.
 */
export function ComposerWords(props: { readonly anchor: string }) {
  const cell = use(PaneCellContext);
  const sendSlot = use(WordsSendSlot);
  const draft = useWordsDraft(cell);
  const draftId = draft?.draftId ?? null;
  const { places, members, recency } = useWordsPlaces();
  const { catalog, ready } = useWordsCatalog(draft?.environmentId ?? null);
  const ctx = draft === null ? null : readContext(places, catalog);
  const setting: WordsSetting | null =
    ctx === null
      ? null
      : {
          ctx,
          ready: (id) => ready.has(id),
          recency: (place) => recency.get(place.place.id) ?? 0,
        };
  const [menu, setMenu] = useState<OpenMenu | null>(null);

  const current = useRef<WordsSetting | null>(setting);
  const driverSource = useRef<DriverSource>({ draftId, catalog, places: new Map() });
  const joined = useRef<{ readonly editor: Editor; readonly driver: WordsDriver } | null>(null);

  useLayoutEffect(() => {
    current.current = setting;
    driverSource.current = {
      draftId,
      catalog,
      places: new Map(
        places.map((p) => [p.id, { name: p.name, members: members.get(p.id) ?? [] }]),
      ),
    };
    const editor = joined.current?.editor;
    if (editor && !editor.isDestroyed) refreshWords(editor.view);
  }, [setting, draftId, catalog, places, members]);

  // The editor remounts when its draft or its text mode changes, so every
  // render looks for the one wearing the anchor now. It is mounted by the
  // time this runs: it renders first, and effects run in that order.
  // Once its draft is sent, the composer lets go of the words.
  useEffect(() => {
    const element = document.querySelector<TiptapEditorHTMLElement>(`.${props.anchor}`);
    const editor = current.current === null ? null : (element?.editor ?? null);
    if (editor !== null && editor === joined.current?.editor && !editor.isDestroyed) return;
    leave(joined.current);
    joined.current = null;
    if (editor === null || editor.isDestroyed) return;
    const driver = new WordsDriver(editor.view, () => driverSource.current);
    editor.registerPlugin(
      wordsPlugin(() => current.current, {
        onChange: (view) => {
          driver.read();
          setMenu((open) =>
            open &&
            wordsKey
              .getState(view.state)
              ?.marks.some((m) => m.from === open.mark.from && m.to === open.mark.to)
              ? open
              : null,
          );
        },
        onToken: (view, mark) => {
          const facts = wordsKey.getState(view.state)?.facts;
          const setting = current.current;
          const { draftId, catalog, places } = driverSource.current;
          if (!facts || !setting) return;
          const selection = draftId === null ? null : readDraftModel(draftId);
          const act = (action: MenuAction) => {
            setMenu(null);
            const text = wordsKey.getState(view.state)?.text;
            if (!text) return;
            if (action.kind === "start-in") {
              const environment =
                draftId === null ? null : readDraftProjectKey(draftId)?.split(":")[0];
              const key = places
                .get(action.placeId)
                ?.members.find((k) => k.startsWith(`${environment}:`));
              if (draftId !== null && key) moveDraft(draftId, key);
              return;
            }
            const { from, to } = rangeOf(text, action.span);
            view.dispatch(
              action.kind === "write"
                ? view.state.tr.insertText(action.text, from, to)
                : view.state.tr.insertText('"', to).insertText('"', from),
            );
            // A word written into the text, or quoted, is done: it acts now.
            driver.read(true);
          };
          const entries = menuFor(mark, {
            facts,
            catalog,
            places: setting.ctx.roster.places,
            recency: setting.recency,
            model: selection ? { instanceId: selection.instanceId, model: selection.model } : null,
          }).map((entry) => ({ ...entry, pick: () => act(entry.action) }));
          setMenu(entries.length === 0 ? null : { mark, at: menuAt(view, mark), entries });
        },
      }),
      (plugin, plugins) => [plugin, ...plugins],
    );
    joined.current = { editor, driver };
  });

  useEffect(
    () => () => {
      leave(joined.current);
      joined.current = null;
    },
    [],
  );

  // The menu closes on Esc, a click elsewhere, and typing (above).
  useEffect(() => {
    if (menu === null) return;
    const close = (event: Event) => {
      if (event instanceof KeyboardEvent) {
        if (event.key !== "Escape") return;
        event.preventDefault();
        event.stopPropagation();
      } else if ((event.target as Element | null)?.closest?.(".sc-word-menu")) return;
      setMenu(null);
    };
    window.addEventListener("keydown", close, true);
    window.addEventListener("pointerdown", close, true);
    return () => {
      window.removeEventListener("keydown", close, true);
      window.removeEventListener("pointerdown", close, true);
    };
  }, [menu]);

  // As the composer sends, the text becomes what the Cell is sent; it
  // comes back if nothing went.
  useEffect(() => {
    if (sendSlot === null) return;
    const beforeSend: BeforeSend = () => {
      const view = joined.current?.editor.view;
      const driver = joined.current?.driver;
      const state = view ? wordsKey.getState(view.state) : undefined;
      if (!view || !driver || !state?.facts || !state.text || draftId === null) return null;
      const outgoing = outgoingOf(state.facts);
      const edits = outgoing === null ? null : editsToward(state.text.text, outgoing);
      if (edits === null || edits.length === 0) return null;
      const text = state.text;
      const before = view.state.doc;
      driver.hold(true);
      let tr = view.state.tr;
      for (const edit of edits.toSorted((a, b) => b.start - a.start || b.end - a.end)) {
        const from =
          edit.start < text.at.length ? text.at[edit.start]! : view.state.doc.content.size - 1;
        const to = edit.end > edit.start ? rangeOf(text, edit).to : from;
        tr = edit.insert ? tr.insertText(edit.insert, from, to) : tr.delete(from, to);
      }
      view.dispatch(tr);
      const sent = view.state.doc;
      return (result) => {
        void Promise.resolve(result)
          .catch(() => undefined)
          .then(() => {
            if (!isDraftGone(draftId) && !view.isDestroyed && view.state.doc.eq(sent))
              view.dispatch(
                view.state.tr
                  .replaceWith(0, view.state.doc.content.size, before.content)
                  .setMeta("addToHistory", false),
              );
            driver.hold(false);
          });
      };
    };
    sendSlot(beforeSend);
    return () => sendSlot(null);
  });

  if (menu === null) return null;
  return (
    <TokenMenu
      key={`${menu.mark.kind}:${menu.mark.from}`}
      at={menu.at}
      label={menu.mark.kind}
      items={menu.entries.map((entry) => ({
        key: entry.key,
        label: entry.label,
        ...(entry.driver
          ? { mark: <ProviderLogo driver={entry.driver} className="size-3.5" /> }
          : {}),
        ...(entry.current ? { current: true } : {}),
        ...(entry.rule ? { rule: true } : {}),
        pick: entry.pick,
      }))}
    />
  );
}

/** The tallest a menu grows before it scrolls (18rem). */
const MENU_TALLEST = 288;
const MENU_GAP = 4;
const MENU_MARGIN = 8;

/**
 * Under the word, or over it when the composer sits too low for the menu:
 * never wider than the composer, never past the window.
 */
function menuAt(view: EditorView, mark: Placed): TokenMenuAt {
  const start = view.coordsAtPos(mark.from);
  const box = view.dom.getBoundingClientRect();
  const left = Math.max(box.left, start.left);
  const width = box.right - left;
  const below = window.innerHeight - start.bottom - MENU_GAP - MENU_MARGIN;
  const above = start.top - MENU_GAP - MENU_MARGIN;
  return below >= MENU_TALLEST || below >= above
    ? { left, width, top: start.bottom + MENU_GAP, maxHeight: Math.min(MENU_TALLEST, below) }
    : {
        left,
        width,
        bottom: window.innerHeight - start.top + MENU_GAP,
        maxHeight: Math.min(MENU_TALLEST, above),
      };
}

/** What a new chat reads with: the projects as places, the models as words. */
function readContext(places: ReadonlyArray<WordsPlace>, catalog: WordsCatalog): ReadContext {
  return { door: "draft", roster: roster(places), models: modelLexicon(catalog) };
}

function leave(joined: { readonly editor: Editor; readonly driver: WordsDriver } | null): void {
  if (joined === null) return;
  joined.driver.dispose();
  if (!joined.editor.isDestroyed) joined.editor.unregisterPlugin(wordsKey);
}
