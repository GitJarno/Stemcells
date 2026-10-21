import type { Editor, TiptapEditorHTMLElement } from "@tiptap/core";
import { use, useEffect, useId, useLayoutEffect, useRef } from "react";

import { PaneCellContext } from "../tabs/paneCell";
import { useWordsCatalog, useWordsDraft, useWordsPlaces } from "../upstream/words";
import { modelLexicon, type WordsCatalog } from "./catalog";
import { roster, type WordsPlace } from "./places";
import type { ReadContext } from "./read";
import { refreshWords, type WordsSetting, wordsKey, wordsPlugin } from "./plugin";
import "../tokens/stemcells.css";
import "./words.css";

/** A class only this composer's editor wears, so the words can find it. */
export function useWordsAnchor(): string {
  return `sc-words-${useId().replace(/[^\w-]/g, "")}`;
}

/**
 * The composer reads what is typed into a new chat: it joins the editor
 * that wears `anchor` with the ink plugin, and keeps the plugin's setting
 * (the projects, the providers' models) current. It draws nothing itself.
 * A sent chat's composer reads nothing: its words set nothing up.
 */
export function ComposerWords(props: { readonly anchor: string }) {
  const cell = use(PaneCellContext);
  const draft = useWordsDraft(cell);
  const { places, recency } = useWordsPlaces();
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

  const current = useRef<WordsSetting | null>(setting);
  const joined = useRef<Editor | null>(null);

  useLayoutEffect(() => {
    current.current = setting;
    const editor = joined.current;
    if (editor !== null && !editor.isDestroyed) refreshWords(editor.view);
  }, [setting]);

  // The editor remounts when its draft or its text mode changes, so every
  // render looks for the one wearing the anchor now. It is mounted by the
  // time this runs: it renders first, and effects run in that order.
  useEffect(() => {
    const element = document.querySelector<TiptapEditorHTMLElement>(`.${props.anchor}`);
    const editor = element?.editor ?? null;
    if (editor === joined.current && !editor?.isDestroyed) return;
    leave(joined.current);
    joined.current = null;
    if (editor === null || editor.isDestroyed || current.current === null) return;
    editor.registerPlugin(
      wordsPlugin(() => current.current),
      (plugin, plugins) => [plugin, ...plugins],
    );
    joined.current = editor;
  });

  useEffect(
    () => () => {
      leave(joined.current);
      joined.current = null;
    },
    [],
  );

  return null;
}

/** What a new chat reads with: the projects as places, the models as words. */
function readContext(places: ReadonlyArray<WordsPlace>, catalog: WordsCatalog): ReadContext {
  return { door: "draft", roster: roster(places), models: modelLexicon(catalog) };
}

function leave(editor: Editor | null): void {
  if (editor !== null && !editor.isDestroyed) editor.unregisterPlugin(wordsKey);
}
