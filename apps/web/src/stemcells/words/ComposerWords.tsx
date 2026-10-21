import type { Editor, TiptapEditorHTMLElement } from "@tiptap/core";
import type { Node as PmNode } from "@tiptap/pm/model";
import type { Transaction } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";
import { use, useEffect, useEffectEvent, useId, useLayoutEffect, useRef, useState } from "react";

import { useAskiPlans } from "../aski/planning";
import { type HoldLine, holdLines } from "../risk/hold";
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
import {
  type CellStart,
  readDraftSetup,
  reportUnstarted,
  useStartCells,
  withSentModel,
} from "../upstream/launch";
import { askPlanner, readProjectLines, recordPlan } from "../upstream/planner";
import { ProviderLogo } from "../upstream/providers";
import { useLimitPools } from "../upstream/rail";
import { useMinute } from "../rail/clock";
import {
  draftHeroBox,
  promptOf,
  useWordsCatalog,
  useWordsDraft,
  useWordsPlaces,
} from "../upstream/words";
import { modelLexicon, type WordsCatalog } from "./catalog";
import {
  cellTitles,
  type Launch,
  type LaunchCell,
  heldOf,
  launchOf,
  MOST_CELLS,
  partLine,
  partOf,
  placesOf,
  type Readout as ReadoutData,
  type ReadoutDefaults,
  readoutOf,
  withPart,
} from "./cells";
import { CHIP, type DocText, rangeOf } from "./docText";
import { type DriverSource, WordsDriver } from "./driver";
import { showPlaces } from "./heroPlaces";
import { limitNotes } from "./limits";
import { effortLabel, type MenuAction, type MenuEntry, menuFor } from "./menu";
import { placeCells } from "./placement";
import {
  askOf,
  needsCheck,
  ownFirst,
  type Plan,
  planTitles,
  readoutOfPlan,
  shortlistOf,
  startsOn,
} from "./plan/plan";
import { type PlanAsk, withChips } from "./plan/ask";
import { escDropsPlan } from "./plan/esc";
import { type PlanOutcome, planRecord } from "./plan/history";
import { planKeyOf } from "./plan/key";
import { type PlannerModel, plannerModel, thinkThrough, type Try } from "./plan/think";
import { roster, type WordsPlace } from "./places";
import { type Placed, refreshWords, type WordsSetting, wordsKey, wordsPlugin } from "./plugin";
import type { Facts, ReadContext } from "./read";
import { WordsReadoutSlot } from "./readoutSlot";
import {
  type BeforeSend,
  type Edit,
  type Outgoing,
  outgoingOf,
  type SendIntent,
  type Sending,
  setupEdits,
  WordsSendSlot,
} from "./send";
import { playForming, playSpawn, type SpawnPlay } from "./spawn/play";
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

/** Aski's plan for the words as they stood when Enter asked for it. */
interface Planning {
  /** What it was made from (`planKeyOf`): any other words drop it. */
  readonly key: string;
  readonly launch: Launch;
  readonly abort: AbortController;
  /** Settles once Aski has thought it through, or the words changed. */
  done: Promise<void>;
  plan: Plan | null;
  /** The risky acts the plan's prompts ask for that the words don't: only ⌘↵ starts it. */
  risk: readonly HoldLine[];
  /** What the planner was asked, and each call: for the plan history. */
  ask: PlanAsk | null;
  readonly tries: Try[];
  /** The plan history has it. */
  told: boolean;
}

/** Puts a plan in the plan history once, with what came of it (decision 19). */
function tell(known: Planning, outcome: PlanOutcome, source: DriverSource): void {
  const defaults = defaultsFor(source);
  if (known.told || known.plan === null || known.ask === null || defaults === null) return;
  known.told = true;
  const risk = known.risk.map((line) => line.sentence.slice(line.trigger.start, line.trigger.end));
  void recordPlan(
    planRecord({
      ask: known.ask,
      tries: known.tries,
      plan: known.plan,
      launch: known.launch,
      defaults,
      risk,
      outcome,
    }),
  );
}

/** What Aski plans with: its model, the plans' limits, and the projects' order and machines. */
interface PlanSource {
  readonly model: PlannerModel | null;
  readonly pools: ReturnType<typeof useLimitPools>;
  readonly recency: ReadonlyMap<string, number>;
  readonly members: ReadonlyMap<string, ReadonlyArray<string>>;
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
  const pools = useLimitPools(useMinute());
  // Off in Settings › Aski, no planner is asked: the words alone set the Cells up.
  const plans = useAskiPlans();
  const thinker = draft === null ? null : plannerModel(catalog, (id) => ready.has(id), plans);

  const current = useRef<WordsSetting | null>(setting);
  const driverSource = useRef<DriverSource>({ draftId, catalog, places: new Map() });
  const joined = useRef<Joined | null>(null);
  const starting = useRef(startCells);
  const planSource = useRef<PlanSource>({ model: thinker, pools, recency, members });
  const planning = useRef<Planning | null>(null);
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
  useLayoutEffect(() => {
    planSource.current = { model: thinker, pools, recency, members };
  });

  /** Several Cells read back, and the hero names their places; one Cell, or none, reads nothing back. */
  const readBack = (view: EditorView) => {
    const facts = wordsKey.getState(view.state)?.facts ?? null;
    // Words changed under a plan, code and chips too: the plan goes with them.
    const known = planning.current;
    if (known !== null && known.key !== planKeyNow(view)) {
      known.abort.abort();
      tell(known, "changed", driverSource.current);
      planning.current = null;
    }
    const next =
      facts === null
        ? null
        : readoutFor(
            facts,
            driverSource.current,
            planSource.current.model !== null,
            planning.current,
          );
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

  // Esc in the composer drops Aski's plan, while it thinks or once it waits
  // for Enter: the words read back as they did before it, and nothing
  // starts. A send waiting on the plan lets go of Enter (`plan/esc.ts`).
  const planShown = readout?.plan !== undefined;
  const dropPlan = useEffectEvent((event: KeyboardEvent) => {
    const view = joined.current?.editor.view;
    if (!view || view.isDestroyed) return;
    const composer = view.dom.closest('[data-chat-composer-stack="true"]');
    const at = {
      inComposer: composer?.contains(document.activeElement) ?? false,
      menuOpen: document.querySelector(".sc-word-menu") !== null,
    };
    if (!escDropsPlan(event, at)) return;
    event.preventDefault();
    event.stopPropagation();
    const known = planning.current;
    if (known !== null) {
      known.abort.abort();
      tell(known, "dropped", driverSource.current);
    }
    planning.current = null;
    readBack(view);
  });
  useEffect(() => {
    if (!planShown) return;
    const drop = (event: KeyboardEvent) => dropPlan(event);
    window.addEventListener("keydown", drop, true);
    return () => window.removeEventListener("keydown", drop, true);
  }, [planShown]);

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

  /** The spawn of a message that starts several Cells, from where its words stand now. */
  const spawnFor = (
    view: EditorView,
    launch: Launch,
    threadId: string,
    named?: readonly string[],
  ): { readonly play: SpawnPlay | null; readonly titles: readonly string[] } | null => {
    const defaults = defaultsFor(driverSource.current);
    const hero = draftHeroBox(view.dom);
    if (defaults === null || hero === null) return null;
    const titles = named ?? cellTitles(launch, defaults);
    const play = playSpawn({
      editor: view.dom,
      hero,
      first: { threadId, title: titles[0] ?? "" },
      titles,
    });
    return { play, titles };
  };

  /**
   * Sends the draft's own Cell what `write` makes of its text and, once it
   * has started, the Cells `besides` it, which land after its pane. Several
   * Cells play the spawn from the words as they stand; a Cell with no spawn
   * to come from forms on its line. The text comes back if nothing went.
   * Returns what to do once upstream's send settles.
   */
  const sendCells = (
    view: EditorView,
    driver: WordsDriver,
    draftId: string,
    input: {
      readonly launch: Launch | null;
      readonly write: (tr: Transaction) => Transaction;
      readonly besides: CellStart[] | null;
      readonly titles?: readonly string[];
    },
  ) => {
    const { launch, besides } = input;
    const setup = launch ? readDraftSetup(draftId) : null;
    // Read now: upstream's send clears the draft's pictures and chips.
    const carry = besides && besides.length > 0 ? readCarry(draftId) : null;
    const pane = cell ? paneShowing(readWorkspace(), cell)?.pane.id : undefined;
    const width = view.dom.closest("[data-stemcells-grid]")?.clientWidth ?? window.innerWidth;
    const before = view.state.doc;
    const spawn = launch && cell ? spawnFor(view, launch, cell.threadId, input.titles) : null;
    if (spawn === null && cell) playForming(cell.threadId);
    driver.hold(true);
    view.dispatch(input.write(view.state.tr));
    const sent = view.state.doc;
    return (result: unknown) => {
      void Promise.resolve(result)
        .catch(() => undefined)
        .then(async () => {
          const gone = isDraftGone(draftId);
          if (!gone && !view.isDestroyed && view.state.doc.eq(sent)) putBack(view, before);
          driver.hold(false);
          if (!gone) {
            spawn?.play?.off();
            return;
          }
          if (!besides || !setup || besides.length === 0 || !cell) {
            spawn?.play?.started([]);
            return;
          }
          const started = await starting
            .current(await withSentModel(setup, cell), besides, carry)
            .finally(() => carry?.release());
          reportUnstarted(started);
          const formed = started.flatMap((s, i) =>
            s.ok ? [{ threadId: s.cell.threadId, title: spawn?.titles[i + 1] ?? "" }] : [],
          );
          if (spawn) spawn.play?.started(formed);
          else for (const one of formed) playForming(one.threadId);
          const cells = started.flatMap((s) => (s.ok ? [s.cell] : []));
          if (pane !== undefined && cells.length > 0)
            updateWorkspace((workspace) => placeCells(workspace, pane, cells, width, newIds));
        });
    };
  };

  /**
   * Asks Aski to plan the Cells only it can share the work out to: the
   * projects the words mention and the recent ones, each with its line;
   * then the call, its checks and the floor (`plan/think.ts`). The readout
   * says Aski is thinking until the plan is in. Null when nothing can plan.
   */
  const startPlanning = (view: EditorView, facts: Facts, launch: Launch): Planning | null => {
    const { model, pools, recency, members } = planSource.current;
    const setting = current.current;
    const defaults = defaultsFor(driverSource.current);
    const text = wordsKey.getState(view.state)?.text;
    if (model === null || setting === null || defaults === null || !text) return null;
    const roster = setting.ctx.roster.places.map((p) => p.place);
    const written = plannerWords(view, text);
    const abort = new AbortController();
    const known: Planning = {
      key: planKeyOf(view.state.doc, text),
      launch,
      abort,
      done: Promise.resolve(),
      plan: null,
      risk: [],
      ask: null,
      tries: [],
      told: false,
    };
    known.done = (async () => {
      // A spent plan makes no call: the floor says why.
      const spent =
        limitNotes([model.driver], pools, Date.now()).find((note) => note.tone === "out")?.text ??
        null;
      const shortlist = shortlistOf(facts, roster, (place) => recency.get(place.id) ?? 0);
      const projectsOf = (placeId: string) =>
        (members.get(placeId) ?? []).map((key) => key.slice(key.indexOf(":") + 1));
      // The lines wait at most a moment, and end with the plan.
      const lines =
        spent === null
          ? await readProjectLines(
              [...new Set(shortlist.flatMap((p) => projectsOf(p.id)))],
              abort.signal,
            )
          : new Map<string, string>();
      const projects = shortlist.map((place) => ({
        name: place.name,
        line: projectsOf(place.id).flatMap((id) => lines.get(id) ?? [])[0] ?? null,
      }));
      known.ask = askOf(facts, launch, defaults, projects, written);
      const plan = await thinkThrough({
        ask: known.ask,
        launch,
        roster,
        call: (prompt) => askPlanner(prompt, model, abort.signal),
        limit: spent,
        signal: abort.signal,
        tried: (one) => known.tries.push(one),
      });
      if (plan === null || planning.current !== known) return;
      known.plan = ownFirst(plan, ownPlace(driverSource.current));
      // The floor sends the person's own words; Aski's are asked about (decision 17).
      if (plan.kind === "planned")
        known.risk = holdLines(
          [withChips(written.text, written.chips)],
          plan.cells.map((cell) => cell.prompt),
        );
      if (waits(known) && !view.isDestroyed) readBack(view);
    })().catch(() => {
      // Thinking broke in a way nothing expected: the plan goes, the words
      // read as before, and the send waiting on it sends nothing.
      if (planning.current !== known) return;
      planning.current = null;
      if (!view.isDestroyed) readBack(view);
    });
    planning.current = known;
    readBack(view);
    return known;
  };

  /** Sends a plan: each Cell its prompt, in its place; the floor sends each the whole message. */
  const sendPlan = (view: EditorView, driver: WordsDriver, draftId: string, known: Planning) => {
    const now = wordsKey.getState(view.state);
    const plan = known.plan;
    if (plan === null || !now?.facts || !now.text || view.isDestroyed) return false;
    // A plan made from other words never replaces these (`plan/key.ts`).
    if (planKeyOf(view.state.doc, now.text) !== known.key) return false;
    const { facts, text } = now;
    const whole = setupEdits(facts.text, facts.grammar, text)?.edits ?? [];
    const wholeText = promptOf(editDoc(view.state.tr, text, whole).doc);
    const [first, ...rest] = plan.cells;
    const besides = driver.besides(
      rest.map((one) => ({
        group: one.group,
        text: plan.kind === "floor" ? wholeText : one.prompt,
        ...(one.picked ? { placeId: one.picked.id } : {}),
      })),
    );
    const defaults = defaultsFor(driverSource.current);
    if (!first || besides === null) return false;
    planning.current = null;
    // Only ⌘↵ sends a plan that holds a risky act.
    tell(known, known.risk.length > 0 ? "anyway" : "started", driverSource.current);
    return sendCells(view, driver, draftId, {
      launch: known.launch,
      besides,
      ...(defaults ? { titles: planTitles(plan, known.launch, defaults) } : {}),
      write: (tr) =>
        plan.kind === "floor"
          ? editDoc(tr, text, whole)
          : tr.replaceWith(0, tr.doc.content.size, paragraphsOf(view, first.prompt)),
    });
  };

  /**
   * Cells only Aski can share the work out to (decisions 11 and 12). The
   * first Enter asks it and waits: a plan that only divides the work
   * starts at once; one where Aski picked a place, or the floor, waits in
   * the readout for a second Enter. Changing the words drops the plan.
   */
  const planSending = (
    view: EditorView,
    driver: WordsDriver,
    draftId: string,
    facts: Facts,
    launch: Launch,
    intent: SendIntent,
  ): Sending => {
    const hold: Sending = { hold: true, ready: null, foreground: false, edit: () => null };
    // Past the most Cells, only ⌘↵ sends.
    if (launch.cells.length > MOST_CELLS && intent !== "background") return hold;
    const madeFrom = planKeyNow(view);
    const known = madeFrom !== null && planning.current?.key === madeFrom ? planning.current : null;
    if (known?.plan) {
      if (!startsOn(known.plan, known.risk.length > 0, intent === "background")) return hold;
      const first = known.plan.cells[0]?.picked ?? null;
      const key = first === null ? null : driver.placeKey(first.id);
      if (first !== null && key === null) return hold;
      // The draft's own Cell goes where Aski put it, and upstream's send has to see it there.
      if (key !== null) moveDraft(draftId, key);
      return {
        hold: false,
        ready: key === null ? null : nextPaint(),
        foreground: true,
        edit: () => sendPlan(view, driver, draftId, known),
      };
    }
    if (known !== null) return hold;
    const started = startPlanning(view, facts, launch);
    if (started === null) return hold;
    return {
      hold: false,
      ready: started.done,
      foreground: true,
      edit: () =>
        planning.current === started && started.plan !== null && !waits(started)
          ? sendPlan(view, driver, draftId, started)
          : false,
    };
  };

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
      const waiting = heldOf(state.facts);
      if (waiting !== null) return planSending(view, driver, draftId, state.facts, waiting, intent);
      // Past the most Cells, only ⌘↵ sends.
      if (launch !== null && launch.cells.length > MOST_CELLS && intent !== "background")
        return held;
      if (out?.empty) return held;
      // A new chat sent as typed: its Cell forms on its line as it starts.
      if (out === null && launch === null)
        return {
          hold: false,
          ready: null,
          foreground: false,
          edit: () => {
            if (cell) playForming(cell.threadId);
            return null;
          },
        };
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
        return sendCells(view, driver, draftId, {
          launch: several,
          besides,
          write: (tr) => {
            const edited = editDoc(tr, text, first?.edits ?? []);
            // A blank line, then its part, as the others are sent theirs (`withPart`).
            return own === null
              ? edited
              : edited.insert(edited.doc.content.size, [
                  paragraphOf(view, ""),
                  paragraphOf(view, partLine(own)),
                ]);
          },
        });
      };
      return { hold: false, ready, foreground: launch !== null, edit };
    };
    return sendSlot("words", beforeSend);
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
 * The words read back when they start several Cells, with what they don't
 * say filled in: the model each would run on, the draft's project. Cells
 * only Aski can share the work out to hold when nothing can plan; while it
 * thinks, and once its plan waits for Enter, the readout says so.
 */
function readoutFor(
  facts: Facts,
  source: DriverSource,
  canPlan: boolean,
  planning: Planning | null,
): ReadoutData | null {
  const launch = launchOf(facts) ?? heldOf(facts);
  const defaults = defaultsFor(source);
  if (launch === null || defaults === null) return null;
  if (planning?.plan && waits(planning)) {
    const line = planning.risk[0];
    const risk = line ? line.sentence.slice(line.trigger.start, line.trigger.end) : undefined;
    return readoutOfPlan(planning.plan, planning.launch, defaults, risk);
  }
  const readout = readoutOf(launch.held ? { ...launch, held: !canPlan } : launch, defaults);
  return planning ? { ...readout, share: "", plan: { state: "thinking" } } : readout;
}

/** What a plan made from the words as they stand now would be made from. */
function planKeyNow(view: EditorView): string | null {
  const text = wordsKey.getState(view.state)?.text;
  return text ? planKeyOf(view.state.doc, text) : null;
}

/** Whether a plan waits for the person: Aski picked a place, it's the floor, or it holds a risky act. */
function waits(planning: Planning): boolean {
  return planning.plan !== null && (needsCheck(planning.plan) || planning.risk.length > 0);
}

/** The place the draft stands in. */
function ownPlace(source: DriverSource): string | null {
  const draftProject = source.draftId === null ? null : readDraftProjectKey(source.draftId);
  if (draftProject === null) return null;
  return [...source.places].find(([, place]) => place.members.includes(draftProject))?.[0] ?? null;
}

/** What a readout fills in that the words don't say, for the draft's composer. */
function defaultsFor(source: DriverSource): ReadoutDefaults | null {
  if (source.draftId === null) return null;
  const draftProject = readDraftProjectKey(source.draftId);
  const own =
    draftProject === null
      ? null
      : ([...source.places.values()].find((p) => p.members.includes(draftProject)) ?? null);
  return {
    model: (placeId) => {
      const selection = defaultModel(source, placeId);
      return selection ? nameOf(source.catalog, selection.instanceId, selection.model) : null;
    },
    place: own?.name ?? null,
    effortLabel,
  };
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

function paragraphsOf(view: EditorView, text: string): PmNode[] {
  return text.split("\n").map((line) => paragraphOf(view, line));
}

/**
 * The message as the planner reads it: its code as written, and each
 * chip's words as upstream sends them, where the reader sees one `CHIP`.
 */
function plannerWords(
  view: EditorView,
  text: DocText,
): { readonly text: string; readonly chips: readonly string[] } {
  const { schema, doc } = view.state;
  const chips: string[] = [];
  for (let i = 0; i < text.raw.length; i++) {
    if (text.raw[i] !== CHIP) continue;
    const node = doc.nodeAt(text.at[i]!);
    let words = "";
    try {
      if (node)
        words = promptOf(
          schema.topNodeType.create(null, schema.nodes.paragraph!.create(null, node)),
        );
    } catch {
      // A chip that can't stand alone reads as nothing.
    }
    chips.push(words.trim());
  }
  return { text: text.raw, chips };
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
