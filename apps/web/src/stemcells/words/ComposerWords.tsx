import type { Editor, TiptapEditorHTMLElement } from "@tiptap/core";
import type { Node as PmNode } from "@tiptap/pm/model";
import type { Transaction } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";
import { use, useEffect, useId, useLayoutEffect, useRef, useState } from "react";

import { paneShowing } from "../tabs/layout";
import { PaneCellContext } from "../tabs/paneCell";
import { newIds, readWorkspace, updateWorkspace } from "../tabs/store";
import {
  isDraftGone,
  moveDraft,
  projectRefOfKey,
  readDraftModel,
  readDraftProjectKey,
  startingModel,
  subscribeDraft,
} from "../upstream/draftWords";
import { readCarry } from "../upstream/carry";
import { readDraftSetup, reportUnstarted, useStartCells, withSentModel } from "../upstream/launch";
import { ProviderLogo } from "../upstream/providers";
import { promptOf, useWordsCatalog, useWordsDraft, useWordsPlaces } from "../upstream/words";
import { modelLexicon, type WordsCatalog } from "./catalog";
import {
  type Launch,
  type LaunchCell,
  heldOf,
  launchOf,
  MOST_CELLS,
  partLine,
  partOf,
  placesOf,
  type Readout as ReadoutData,
  readoutOf,
  withPart,
} from "./cells";
import { type DocText, rangeOf } from "./docText";
import { type DriverSource, WordsDriver } from "./driver";
import { showPlaces } from "./heroPlaces";
import { effortLabel, type MenuAction, type MenuEntry, menuFor } from "./menu";
import { placeCells } from "./placement";
import { roster, type WordsPlace } from "./places";
import { type Placed, refreshWords, type WordsSetting, wordsKey, wordsPlugin } from "./plugin";
import type { Facts, ReadContext } from "./read";
import { WordsReadoutSlot } from "./readoutSlot";
import {
  type BeforeSend,
  type Edit,
  type Outgoing,
  outgoingOf,
  setupEdits,
  WordsSendSlot,
} from "./send";
import type { Span } from "./text";
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

interface Joined {
  readonly editor: Editor;
  readonly driver: WordsDriver;
}

/**
 * The composer reads what is typed into a new chat. It joins the editor
 * that wears `anchor` with the ink plugin, keeps the draft in step with
 * the words (`driver.ts`), opens a read word's menu, reads several Cells
 * back (`Readout`), and makes the text what is sent (`send.ts`). A sent
 * chat's composer reads nothing: its words set nothing up.
 */
export function ComposerWords(props: { readonly anchor: string }) {
  const cell = use(PaneCellContext);
  const sendSlot = use(WordsSendSlot);
  const readoutSlot = use(WordsReadoutSlot);
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
  const [readout, setReadout] = useState<ReadoutData | null>(null);
  const [drivers, setDrivers] = useState<readonly string[]>([]);
  const startCells = useStartCells();

  const current = useRef<WordsSetting | null>(setting);
  const driverSource = useRef<DriverSource>({ draftId, catalog, places: new Map() });
  const joined = useRef<Joined | null>(null);
  const starting = useRef(startCells);
  // The draft the hero names places for, so they go when the draft does.
  const named = useRef<string | null>(null);

  const nameInHero = (draftId: string | null, places: readonly string[] | null) => {
    if (named.current !== null && named.current !== draftId) showPlaces(named.current, null);
    named.current = draftId;
    if (draftId !== null) showPlaces(draftId, places);
  };

  useLayoutEffect(() => {
    current.current = setting;
    starting.current = startCells;
    driverSource.current = {
      draftId,
      catalog,
      places: new Map(
        places.map((p) => [p.id, { name: p.name, members: members.get(p.id) ?? [] }]),
      ),
    };
    const editor = joined.current?.editor;
    if (editor && !editor.isDestroyed) refreshWords(editor.view);
  }, [setting, startCells, draftId, catalog, places, members]);

  /** Several Cells read back, and the hero names their places; one Cell, or none, reads nothing back. */
  const readBack = (view: EditorView) => {
    const facts = wordsKey.getState(view.state)?.facts ?? null;
    const next = facts === null ? null : readoutFor(facts, driverSource.current);
    setReadout((last) => (JSON.stringify(last) === JSON.stringify(next) ? last : next));
    nameInHero(driverSource.current.draftId, next === null ? null : placesOf(next));
    const on = next === null || facts === null ? [] : driversFor(facts, driverSource.current);
    setDrivers((last) => (JSON.stringify(last) === JSON.stringify(on) ? last : on));
  };

  const openMenu = (view: EditorView, mark: Placed, at: TokenMenuAt) => {
    const facts = wordsKey.getState(view.state)?.facts;
    const setting = current.current;
    const driver = joined.current?.driver;
    const { draftId, catalog, places } = driverSource.current;
    if (!facts || !setting || !driver) return;
    const selection = draftId === null ? null : readDraftModel(draftId);
    const act = (action: MenuAction) => {
      setMenu(null);
      const text = wordsKey.getState(view.state)?.text;
      if (!text) return;
      if (action.kind === "start-in") {
        const environment = draftId === null ? null : readDraftProjectKey(draftId)?.split(":")[0];
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
    setMenu(entries.length === 0 ? null : { mark, at, entries });
  };

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
    setReadout(null);
    nameInHero(null, null);
    if (editor === null || editor.isDestroyed) return;
    const driver = new WordsDriver(editor.view, () => driverSource.current);
    editor.registerPlugin(
      wordsPlugin(() => current.current, {
        onChange: (view) => {
          driver.read();
          readBack(view);
          setMenu((open) =>
            open &&
            wordsKey
              .getState(view.state)
              ?.marks.some((m) => m.from === open.mark.from && m.to === open.mark.to)
              ? open
              : null,
          );
        },
        onToken: (view, mark) => openMenu(view, mark, menuAt(view, mark)),
      }),
      (plugin, plugins) => [plugin, ...plugins],
    );
    joined.current = { editor, driver };
  });

  useEffect(
    () => () => {
      leave(joined.current);
      joined.current = null;
      if (named.current !== null) showPlaces(named.current, null);
      named.current = null;
    },
    [],
  );

  // A pick in the hero or a picker changes what the readout fills in.
  useEffect(() => {
    if (draftId === null) return;
    return subscribeDraft(draftId, () => {
      const view = joined.current?.editor.view;
      if (view && !view.isDestroyed) readBack(view);
    });
  });

  // The composer says how many Cells Send starts, and the effort picker
  // makes way for the readout (`words.css`). Upstream re-renders its controls,
  // so every render marks them again; leaving takes the marks off.
  useEffect(() => {
    const view = joined.current?.editor.view;
    if (view && !view.isDestroyed) markComposer(view.dom, readout);
  });

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

  // As the composer sends, the text becomes what the draft's Cell is sent;
  // it comes back if nothing went. When the words start several Cells, the
  // rest start once the draft's has, and land after its pane. Nothing is
  // sent when the words were only setup.
  useEffect(() => {
    if (sendSlot === null) return;
    const beforeSend: BeforeSend = (intent) => {
      const view = joined.current?.editor.view;
      const driver = joined.current?.driver;
      const state = view ? wordsKey.getState(view.state) : undefined;
      if (!view || !driver || !state?.facts || !state.text || draftId === null) return null;
      const launch = launchOf(state.facts);
      const out = outgoingFor(state.facts, state.text);
      const held = { hold: true, ready: null, foreground: false, edit: () => null };
      // Cells only the planner could share the work out to wait for it,
      // with every word kept.
      if (heldOf(state.facts) !== null) return held;
      // Past the most Cells, only ⌘↵ sends.
      if (launch !== null && launch.cells.length > MOST_CELLS && intent !== "background")
        return held;
      if (out?.empty) return held;
      if (out === null && launch === null) return null;
      // A word still at the caret acts now, and upstream's send has to see it.
      const ready = driver.settle() ? nextPaint() : null;
      const edit = () => {
        const now = wordsKey.getState(view.state);
        if (!now?.facts || !now.text || view.isDestroyed) return null;
        const { facts, text } = now;
        const several = launchOf(facts);
        const first = outgoingFor(facts, text);
        if (first?.empty) return false;
        if (first === null && several === null) return null;
        const own = several ? partOf(facts, several.cells[0]!.part, text) : null;
        const besides = several ? driver.besides(siblingsOf(view, facts, text, several)) : null;
        const setup = several ? readDraftSetup(draftId) : null;
        // Read now: upstream's send clears the draft's pictures and chips.
        const carry = besides && besides.length > 0 ? readCarry(draftId) : null;
        const pane = cell ? paneShowing(readWorkspace(), cell)?.pane.id : undefined;
        const width = view.dom.closest("[data-stemcells-grid]")?.clientWidth ?? window.innerWidth;
        const before = view.state.doc;
        driver.hold(true);
        let tr = editDoc(view.state.tr, text, first?.edits ?? []);
        // A blank line, then its part, as the others are sent theirs (`withPart`).
        if (own !== null)
          tr = tr.insert(tr.doc.content.size, [
            paragraphOf(view, ""),
            paragraphOf(view, partLine(own)),
          ]);
        view.dispatch(tr);
        const sent = view.state.doc;
        return (result: unknown) => {
          void Promise.resolve(result)
            .catch(() => undefined)
            .then(async () => {
              const gone = isDraftGone(draftId);
              if (!gone && !view.isDestroyed && view.state.doc.eq(sent)) putBack(view, before);
              driver.hold(false);
              if (!gone || !besides || !setup || besides.length === 0 || !cell) return;
              const started = await starting
                .current(await withSentModel(setup, cell), besides, carry)
                .finally(() => carry?.release());
              reportUnstarted(started);
              const cells = started.flatMap((s) => (s.ok ? [s.cell] : []));
              if (pane !== undefined && cells.length > 0)
                updateWorkspace((workspace) => placeCells(workspace, pane, cells, width, newIds));
            });
        };
      };
      return { hold: false, ready, foreground: launch !== null, edit };
    };
    sendSlot(beforeSend);
    return () => sendSlot(null);
  });

  // The readout stands in the model picker's place (`readoutSlot.ts`), and
  // a token clicked there opens its menu as the word in the text would.
  const openFromReadout = (mark: Span, rect: DOMRect) => {
    const view = joined.current?.editor.view;
    const placed = view
      ? wordsKey
          .getState(view.state)
          ?.marks.find((m) => m.start === mark.start && m.end === mark.end)
      : undefined;
    if (view && placed) openMenu(view, placed, menuAtRect(rect, view.dom.getBoundingClientRect()));
  };
  const fromReadout = useRef(openFromReadout);
  useEffect(() => {
    fromReadout.current = openFromReadout;
  });
  const [onWord] = useState(() => (mark: Span, rect: DOMRect) => fromReadout.current(mark, rect));
  useEffect(() => {
    if (readoutSlot === null || readout === null) return;
    readoutSlot({ readout, drivers, onWord });
    return () => readoutSlot(null);
  }, [readoutSlot, readout, drivers, onWord]);

  return (
    <>
      {menu ? (
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
      ) : null}
    </>
  );
}

/**
 * The words read back when they start several Cells alone, with what they
 * don't say filled in: the model each would run on, the draft's project.
 */
function readoutFor(facts: Facts, source: DriverSource): ReadoutData | null {
  const launch = launchOf(facts) ?? heldOf(facts);
  if (launch === null || source.draftId === null) return null;
  const draftProject = readDraftProjectKey(source.draftId);
  const own =
    draftProject === null
      ? null
      : ([...source.places.values()].find((p) => p.members.includes(draftProject)) ?? null);
  return readoutOf(launch, {
    model: (placeId) => {
      const selection = defaultModel(source, placeId);
      return selection ? nameOf(source.catalog, selection.instanceId, selection.model) : null;
    },
    place: own?.name ?? null,
    effortLabel,
  });
}

/** The providers several Cells start on, as drivers: each one's model word's, or its default's. */
function driversFor(facts: Facts, source: DriverSource): string[] {
  const launch = launchOf(facts) ?? heldOf(facts);
  if (launch === null) return [];
  return launch.cells.flatMap(({ group }) => {
    const id = group.model
      ? group.model.form.provider.id
      : defaultModel(source, group.place?.place.place.id ?? null)?.instanceId;
    const driver = source.catalog.providers.find((p) => p.id === id)?.driver;
    return driver === undefined ? [] : [driver];
  });
}

/**
 * The model a Cell starts on when its words name none: the draft's pick,
 * else its place's project default, else the last one used, else the
 * draft's own (decision 14).
 */
function defaultModel(
  source: DriverSource,
  placeId: string | null,
): { readonly instanceId: string; readonly model: string } | null {
  if (source.draftId === null) return null;
  const draftProject = readDraftProjectKey(source.draftId);
  const setup = readDraftSetup(source.draftId);
  const environment = draftProject?.slice(0, draftProject.indexOf(":")) ?? "";
  const members = placeId === null ? [] : (source.places.get(placeId)?.members ?? []);
  const key =
    placeId === null
      ? draftProject
      : (members.find((k) => k.startsWith(`${environment}:`)) ?? members[0] ?? null);
  return (
    setup?.pick ??
    (key === null ? null : startingModel(projectRefOfKey(key))) ??
    setup?.current ??
    null
  );
}

function nameOf(catalog: WordsCatalog, instanceId: string, model: string): string {
  return (
    catalog.providers.find((p) => p.id === instanceId)?.models.find((m) => m.id === model)?.name ??
    model
  );
}

/**
 * What the draft's own Cell is sent: its [bracket], or the text without
 * its setup words; empty when it or any Cell beside it would get nothing.
 * Null when the words set nothing up (or start Cells only Aski can plan),
 * so the text goes as written.
 */
function outgoingFor(facts: Facts, text: DocText): Outgoing | null {
  if (facts.cell !== null) return null;
  const several = launchOf(facts);
  const part = several
    ? several.cells[0]!.part
    : facts.cells.length === 1
      ? facts.cells[0]!.part
      : null;
  if (part === null) return null;
  const out = outgoingOf(facts, part, text);
  // A Cell whose own [bracket] holds nothing would be sent nothing.
  const bare = several?.cells.some(
    (c) => c.part.kind === "verbatim" && outgoingOf(facts, c.part, text)?.empty,
  );
  return bare ? { edits: out?.edits ?? [], empty: true } : out;
}

/**
 * What the Cells after the first are sent: a [bracket] word for word, or
 * the message without its setup words, as upstream would send it, with
 * the Cell's own part.
 */
function siblingsOf(
  view: EditorView,
  facts: Facts,
  text: DocText,
  launch: Launch,
): Array<{ readonly group: LaunchCell["group"]; readonly text: string }> {
  const sent = (edits: readonly Edit[] | undefined) =>
    promptOf(editDoc(view.state.tr, text, edits ?? []).doc);
  const whole = sent(setupEdits(facts.text, facts.grammar, text)?.edits);
  return launch.cells.slice(1).map((cell) => {
    if (cell.part.kind === "verbatim")
      return { group: cell.group, text: sent(outgoingOf(facts, cell.part, text)?.edits) };
    const part = partOf(facts, cell.part, text);
    return { group: cell.group, text: part === null ? whole : withPart(whole, part) };
  });
}

/** The edits made on the document, by where each character of the text sits. */
function editDoc(tr: Transaction, text: DocText, edits: readonly Edit[]): Transaction {
  for (const edit of edits.toSorted((a, b) => b.start - a.start || b.end - a.end)) {
    const from = edit.start < text.at.length ? text.at[edit.start]! : tr.doc.content.size - 1;
    const to = edit.end > edit.start ? rangeOf(text, edit).to : from;
    tr = edit.insert ? tr.insertText(edit.insert, from, to) : tr.delete(from, to);
  }
  return tr;
}

function paragraphOf(view: EditorView, line: string): PmNode {
  const { schema } = view.state;
  return schema.nodes.paragraph!.create(null, line.length > 0 ? schema.text(line) : null);
}

/** The text as it was before the send, when nothing was sent. */
function putBack(view: EditorView, before: PmNode): void {
  view.dispatch(
    view.state.tr
      .replaceWith(0, view.state.doc.content.size, before.content)
      .setMeta("addToHistory", false),
  );
}

/** After the draft's change has painted, so upstream's send reads it. */
function nextPaint(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0)));
}

/** Marks the composer and its Send button with the Cells it starts (`words.css`). */
function markComposer(editor: HTMLElement, readout: ReadoutData | null): void {
  const stack = editor.closest<HTMLElement>('[data-chat-composer-stack="true"]');
  if (!stack) return;
  const send = stack.querySelector<HTMLElement>(
    '[data-chat-composer-footer="true"] button[type="submit"]',
  );
  for (const element of [stack, send]) {
    if (!element) continue;
    if (readout) element.setAttribute("data-stemcells-cells", String(readout.total));
    else element.removeAttribute("data-stemcells-cells");
  }
  if (readout?.over || readout?.held) send?.setAttribute("data-stemcells-over", "");
  else send?.removeAttribute("data-stemcells-over");
}

/** The tallest a menu grows before it scrolls (18rem). */
const MENU_TALLEST = 288;
const MENU_GAP = 4;
const MENU_MARGIN = 8;

function menuAt(view: EditorView, mark: Placed): TokenMenuAt {
  return menuAtRect(view.coordsAtPos(mark.from), view.dom.getBoundingClientRect());
}

/**
 * Under the word, or over it when the composer sits too low for the menu:
 * never wider than the composer, never past the window.
 */
function menuAtRect(
  word: { readonly left: number; readonly top: number; readonly bottom: number },
  box: DOMRect,
): TokenMenuAt {
  const left = Math.max(box.left, word.left);
  const width = box.right - left;
  const below = window.innerHeight - word.bottom - MENU_GAP - MENU_MARGIN;
  const above = word.top - MENU_GAP - MENU_MARGIN;
  return below >= MENU_TALLEST || below >= above
    ? { left, width, top: word.bottom + MENU_GAP, maxHeight: Math.min(MENU_TALLEST, below) }
    : {
        left,
        width,
        bottom: window.innerHeight - word.top + MENU_GAP,
        maxHeight: Math.min(MENU_TALLEST, above),
      };
}

/** What a new chat reads with: the projects as places, the models as words. */
function readContext(places: ReadonlyArray<WordsPlace>, catalog: WordsCatalog): ReadContext {
  return { door: "draft", roster: roster(places), models: modelLexicon(catalog) };
}

function leave(joined: Joined | null): void {
  if (joined === null) return;
  joined.driver.dispose();
  if (joined.editor.isDestroyed) return;
  markComposer(joined.editor.view.dom, null);
  joined.editor.unregisterPlugin(wordsKey);
}
