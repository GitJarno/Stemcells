/**
 * Keeps an unsent draft in step with its words (`follow.ts` decides): points it at the project
 * the words name, sets model and effort, puts back what the draft had when a word goes, and
 * writes a pick back into the words. Each word flies to the control it set, which wears a mark
 * saying the words set it.
 */

import type { EditorView } from "@tiptap/pm/view";

import {
  type DraftModelState,
  moveDraft,
  projectRefOf,
  projectRefOfKey,
  readDraftModel,
  readDraftModelState,
  readDraftProjectKey,
  restoreDraftModelState,
  setDraftModel,
  startingModel,
  subscribeDraft,
} from "../upstream/draftWords";
import { type CellStart, readDraftSetup } from "../upstream/launch";
import { type WordsCatalog, type WordsModel, type WordsProvider, clampEffort } from "./catalog";
import { offsetOf, rangeOf } from "./docText";
import { fly } from "./flight";
import {
  type Current,
  type ModelKey,
  type Taken,
  type Want,
  choiceOf,
  follow,
  isDone,
} from "./follow";
import type { ModelHit } from "./models";
import type { CellGroup } from "./read";
import { wordsKey } from "./plugin";
import type { Span } from "./text";

/** How long a word at the caret waits before it acts (decision 5). */
export const PAUSE_MS = 500;

export interface DriverSource {
  /** The unsent draft the composer writes, or null. */
  readonly draftId: string | null;
  readonly catalog: WordsCatalog;
  /** Each place's projects and its name, by the rail's key. */
  readonly places: ReadonlyMap<
    string,
    { readonly name: string; readonly members: readonly string[] }
  >;
}

/** Where a word's control is: the hero's project, the model picker, the effort picker. */
const CONTROL = {
  project: "[data-draft-project-trigger]",
  model: '[data-chat-provider-model-picker="true"]',
  effort: '[data-composer-shortcut="composer.effort"]',
} as const;

export class WordsDriver {
  private taken: Taken<DraftModelState> = { project: null, model: null };
  private pause: ReturnType<typeof setTimeout> | undefined;
  /** While a send is underway the words stand still: what they set is being sent. */
  private held = false;
  private reading = false;
  private again = false;
  /** A send that settles after the composer let go wakes nothing. */
  private disposed = false;
  /** This reading changed the draft (`settle`). */
  private acted = false;
  /** The latest flight to each control. */
  private readonly flights = new WeakMap<Element, number>();
  private marked = new Set<HTMLElement>();

  private unsubscribe: () => void = () => {};
  private watching: string | null = null;

  constructor(
    private readonly view: EditorView,
    private readonly source: () => DriverSource,
  ) {}

  /** Reads again when the draft's project or model changes outside the words. */
  private watch(draftId: string | null): void {
    if (draftId === this.watching) return;
    this.unsubscribe();
    this.watching = draftId;
    this.unsubscribe = draftId === null ? () => {} : subscribeDraft(draftId, () => this.read());
  }

  /**
   * Brings the draft in step with every word, done or not, as the composer
   * sends; true when that changed the draft, which upstream's send then
   * has to see before it reads it.
   */
  settle(): boolean {
    this.acted = false;
    this.read(true);
    return this.acted;
  }

  /**
   * What the Cells after the first start with: their project in the
   * draft's environment (the draft's own for a Cell the words give none),
   * and the model and effort the words name, clamped to the model's own.
   * An effort with no model applies to the model the Cell would run on.
   */
  besides(
    cells: ReadonlyArray<{
      readonly group: CellGroup;
      readonly text: string;
      /** The place Aski picked, where the words left it open. */
      readonly placeId?: string;
    }>,
  ): CellStart[] | null {
    const { draftId, catalog } = this.source();
    if (draftId === null) return null;
    const draftProject = readDraftProjectKey(draftId);
    const setup = readDraftSetup(draftId);
    if (draftProject === null || setup === null) return null;
    const starts: CellStart[] = [];
    for (const cell of cells) {
      const placeId = cell.placeId ?? cell.group.place?.place.place.id ?? null;
      const projectKey = placeId === null ? draftProject : this.projectKeyOf(placeId, draftProject);
      if (projectKey === null) return null;
      const named = cell.group.model ? modelFor(cell.group.model, catalog) : null;
      const effortWord = cell.group.effort;
      const base =
        named ??
        (effortWord
          ? keyOf(
              setup.pick ?? startingModel(projectRefOfKey(projectKey)) ?? setup.current,
              catalog,
            )
          : null);
      const model = base && findModel(catalog, base.instanceId, base.model);
      const level = effortWord && model ? clampEffort(effortWord.level, model.efforts) : null;
      starts.push({
        projectKey,
        model: base
          ? {
              instanceId: base.instanceId,
              model: base.model,
              effort:
                level !== null && model?.effortOption
                  ? { option: model.effortOption, level }
                  : null,
            }
          : null,
        text: cell.text,
      });
    }
    return starts;
  }

  /** A place's project as `environmentId:projectId`, in the draft's environment when it has one there. */
  placeKey(placeId: string): string | null {
    const { draftId } = this.source();
    return this.projectKeyOf(placeId, draftId === null ? null : readDraftProjectKey(draftId));
  }

  private projectKeyOf(placeId: string, draftProject: string | null): string | null {
    const environment = draftProject?.slice(0, draftProject.indexOf(":")) ?? "";
    const ref = projectRefOf(this.source().places.get(placeId)?.members ?? [], environment);
    return ref ? `${ref.environmentId}:${ref.projectId}` : null;
  }

  hold(held: boolean): void {
    this.held = held;
    if (!held) this.read();
  }

  dispose(): void {
    this.disposed = true;
    clearTimeout(this.pause);
    this.unsubscribe();
    this.mark(null);
  }

  /** Brings the draft in step with the words; `paused` after the person stopped typing. */
  read(paused = false): void {
    if (this.disposed) return;
    // A pick written into the words changes the text, which reads again:
    // finish this reading first, then read once more.
    if (this.reading) {
      this.again = true;
      return;
    }
    this.reading = true;
    try {
      this.step(paused);
    } finally {
      this.reading = false;
    }
    if (this.again) {
      this.again = false;
      this.read(paused);
    }
  }

  private step(paused: boolean): void {
    clearTimeout(this.pause);
    const { draftId, catalog, places } = this.source();
    this.watch(draftId);
    const state = wordsKey.getState(this.view.state);
    if (this.held || draftId === null || !state?.facts || !state.text) return;
    const { facts, text } = state;
    const caret = this.view.hasFocus() ? offsetOf(text, this.view.state.selection.from) : -1;
    const choice = choiceOf(facts);
    // Several Cells read back in the readout; only one Cell's words fly.
    const flies = facts.cells.length === 1;
    const done = (span: Span) => isDone(text.text, span, caret, paused);
    let waiting = false;

    const draftProject = readDraftProjectKey(draftId);
    const projectKeyOf = (placeId: string) => this.projectKeyOf(placeId, draftProject);

    let wantProject: Want["project"] = null;
    if (choice?.place) {
      const key = projectKeyOf(choice.place.place.place.id);
      if (key !== null)
        wantProject = done(choice.place) ? { key, word: choice.place } : ((waiting = true), "wait");
    }

    const current: Current = {
      project: draftProject,
      model: keyOf(readDraftModel(draftId), catalog),
    };
    let wantModel: Want["model"] = null;
    const modelWord = choice?.model ?? null;
    const effortWord = choice?.effort ?? null;
    if (modelWord || effortWord) {
      const words = [modelWord, effortWord].filter((w) => w !== null);
      if (!words.every(done)) {
        waiting = true;
        wantModel = "wait";
      } else {
        const to = modelWord
          ? modelFor(modelWord, catalog)
          : current.model && { ...current.model, effort: null };
        const model = to && findModel(catalog, to.instanceId, to.model);
        if (to && model) {
          const effort = effortWord ? clampEffort(effortWord.level, model.efforts) : null;
          wantModel = { to: { ...to, effort }, word: modelWord ?? effortWord! };
        }
      }
    }

    const { taken, steps } = follow(
      this.taken,
      { project: wantProject, model: wantModel },
      current,
      () => readDraftModelState(draftId),
    );
    this.taken = taken;
    for (const step of steps) {
      if (step.kind === "move") {
        moveDraft(draftId, step.to);
        this.acted = true;
        if (step.word && flies) this.flyFrom(step.word, "project");
      } else if (step.kind === "model") {
        const model = findModel(catalog, step.to.instanceId, step.to.model);
        setDraftModel(
          draftId,
          step.to.instanceId,
          step.to.model,
          step.to.effort !== null && model?.effortOption
            ? { option: model.effortOption, level: step.to.effort }
            : null,
        );
        this.acted = true;
        if (modelWord && flies) this.flyFrom(modelWord, "model");
        if (effortWord && flies) this.flyFrom(effortWord, "effort");
      } else if (step.kind === "restore-model") {
        restoreDraftModelState(draftId, step.own);
        this.acted = true;
      } else if (step.kind === "rewrite-project") {
        const place = [...places].find(([, p]) => p.members.includes(step.to))?.[1];
        if (place) this.rewrite([{ span: step.word, text: place.name }]);
      } else {
        const edits: { span: Span; text: string }[] = [];
        const model = findModel(catalog, step.to.instanceId, step.to.model);
        if (modelWord && model) edits.push({ span: modelWord, text: model.name });
        if (effortWord && step.to.effort !== null)
          edits.push({ span: effortWord, text: step.to.effort });
        this.rewrite(edits);
      }
    }
    this.mark({
      project: taken.project !== null,
      model: taken.model !== null && modelWord !== null,
      effort: taken.model !== null && effortWord !== null,
    });
    if (waiting) this.pause = setTimeout(() => this.read(true), PAUSE_MS);
  }

  /** Writes a pick into the words, last first so each span still points where it did. */
  private rewrite(edits: ReadonlyArray<{ readonly span: Span; readonly text: string }>): void {
    const text = wordsKey.getState(this.view.state)?.text;
    if (!text || edits.length === 0) return;
    let tr = this.view.state.tr;
    for (const edit of edits.toSorted((a, b) => b.span.start - a.span.start)) {
      const { from, to } = rangeOf(text, edit.span);
      tr = tr.insertText(edit.text, from, to);
    }
    this.view.dispatch(tr);
  }

  private flyFrom(word: Span, control: keyof typeof CONTROL): void {
    const text = wordsKey.getState(this.view.state)?.text;
    const target = this.controlOf(control);
    if (!text || !target) return;
    const { from, to } = rangeOf(text, word);
    const start = this.view.coordsAtPos(from);
    const end = this.view.coordsAtPos(to, -1);
    const rect = new DOMRect(
      start.left,
      start.top,
      end.right - start.left,
      start.bottom - start.top,
    );
    const landed = fly(
      this.view.state.doc.textBetween(from, to),
      rect,
      target,
      getComputedStyle(this.view.dom),
    );
    if (landed === null) return;
    // The control's new value waits for its word (`words.css`); a later
    // flight to it keeps it waiting for that one.
    const flight = (this.flights.get(target) ?? 0) + 1;
    this.flights.set(target, flight);
    target.setAttribute("data-stemcells-landing", "");
    void landed.finally(() => {
      if (this.flights.get(target) === flight) target.removeAttribute("data-stemcells-landing");
    });
  }

  /** A control in this composer's pane (the hero), or in this composer (the pickers). */
  private controlOf(control: keyof typeof CONTROL): HTMLElement | null {
    const scope =
      control === "project"
        ? this.view.dom.closest("[data-stemcells-pane]")
        : this.view.dom.closest('[data-chat-composer-stack="true"]');
    return scope?.querySelector<HTMLElement>(CONTROL[control]) ?? null;
  }

  /**
   * The controls the words set wear a mark that says so (`words.css`). It
   * comes off the ones that wore it, so a control that outlives this
   * composer, or the draft it set, doesn't keep it.
   */
  private mark(set: Record<keyof typeof CONTROL, boolean> | null): void {
    const wearing = new Set<HTMLElement>();
    for (const control of Object.keys(CONTROL) as (keyof typeof CONTROL)[]) {
      const element = set?.[control] ? this.controlOf(control) : null;
      if (element) wearing.add(element);
    }
    for (const element of this.marked)
      if (!wearing.has(element)) element.removeAttribute("data-stemcells-from-words");
    for (const element of wearing) element.setAttribute("data-stemcells-from-words", "");
    this.marked = wearing;
  }
}

/** The model a word names: its own, or its provider's default for "claude". */
function modelFor(hit: ModelHit, catalog: WordsCatalog): ModelKey | null {
  const provider = catalog.providers.find((p) => p.id === hit.form.provider.id);
  const model = hit.form.model?.id ?? provider?.defaultModel;
  return provider && model ? { instanceId: provider.id, model, effort: null } : null;
}

function findModel(catalog: WordsCatalog, instanceId: string, model: string): WordsModel | null {
  const provider: WordsProvider | undefined = catalog.providers.find((p) => p.id === instanceId);
  return provider?.models.find((m) => m.id === model) ?? null;
}

/** A draft's model selection as a key: its instance, its model and its effort's value. */
function keyOf(
  selection: {
    readonly instanceId: string;
    readonly model: string;
    readonly options?: ReadonlyArray<{ readonly id: string; readonly value: unknown }>;
  } | null,
  catalog: WordsCatalog,
): ModelKey | null {
  if (selection === null) return null;
  const option = findModel(catalog, selection.instanceId, selection.model)?.effortOption;
  const value = selection.options?.find((o) => o.id === option)?.value;
  return {
    instanceId: selection.instanceId,
    model: selection.model,
    effort: typeof value === "string" ? value : null,
  };
}
