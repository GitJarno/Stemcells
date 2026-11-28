// A plan: what one message to Aski becomes (stemcells/tasks/aski-orchestrator.md, decisions 2
// and 4). The server makes it, both clients draw it, and a client carries it out with the
// person's own access. Nothing here runs anything.

import type { Piece } from "./pieces.ts";
import type { RiskKind } from "../risk/floor.ts";

/** A project a Cell can start in, as the client names it. */
export interface PlaceEntry {
  /** The client's own key for the place; the server hands it back untouched. */
  readonly id: string;
  /** As the sidebar writes it. */
  readonly name: string;
  /** Other names the person gave it, and ones Aski learned from their confirms. */
  readonly aliases?: readonly string[];
}

/** A model a Cell can run on. */
export interface ModelEntry {
  readonly instanceId: string;
  /** The provider's slug; what a launch sends. */
  readonly id: string;
  /** As a person reads it: "Fable 5.1". */
  readonly name: string;
  /** Its provider's word: "claude". */
  readonly provider: string;
  readonly aliases?: readonly string[];
  /** Its effort levels in the provider's order; empty when it has none. */
  readonly efforts: readonly string[];
  /** The option that holds its effort ("effort", "reasoningEffort"). */
  readonly effortOption?: string;
}

/** A Cell that is awake, for "archive Otter and Badger". */
export interface LiveCell {
  readonly threadId: string;
  readonly name: string;
}

/** What a client tells the server about the person's world when it asks for a plan. */
export interface CompileContext {
  /** Most recently used first. */
  readonly places: readonly PlaceEntry[];
  readonly models: readonly ModelEntry[];
  readonly cells: readonly LiveCell[];
  /** The most Cells one message starts without a check. */
  readonly cap: number;
  /** Settings › Aski › Check Aski's plan: Always. */
  readonly always: boolean;
  /** Speech put some of the message there. */
  readonly dictated: boolean;
}

/** The most Cells one message ever starts, whatever the cap. */
export const CEILING = 12;
/** The cap until the person sets one. */
export const DEFAULT_CAP = 6;

/**
 * How a field was read. `exact`: said as it is written. `near`: read from a word that isn't its
 * name ("harbour"). `picked`: none was named, and Aski chose. `new`: a project to make first.
 */
export type How = "exact" | "near" | "picked" | "new";

export interface PlaceField {
  /** The client's key for the place. Null for a project that doesn't exist yet, or one the server named. */
  readonly id: string | null;
  /** The project on this server, when the server named the place (a plan Aski's chat proposed). */
  readonly projectId?: string;
  readonly name: string;
  /** The person's own word for it, when they said one. */
  readonly heard: string | null;
  readonly how: How;
}

export interface ModelField {
  readonly instanceId: string;
  readonly id: string;
  readonly name: string;
  readonly heard: string;
  readonly how: "exact" | "near";
  /** The effort option and level a launch sends; null for the model's default. */
  readonly effort: { readonly option: string; readonly level: string } | null;
}

/** A provider instance, a model and its options, as a launch takes them. */
export interface Selection {
  readonly instanceId: string;
  readonly model: string;
  readonly options?: ReadonlyArray<{ readonly id: string; readonly value: string | boolean }>;
}

/** `start` begins at once; `check` waits for one tap; `hold` needs a hand on the named thing. */
export type Tier = "start" | "check" | "hold";

/** Why an act waits. */
export type Why =
  /** No project was named, and none fits. */
  | "place-open"
  /** Aski chose the project. */
  | "place-picked"
  /** The project was read from a word that isn't its name. */
  | "place-near"
  /** The project was said, but not for this Cell as code reads the sentence. */
  | "place-apart"
  | "new-project"
  /** Its words ask for something that can't be taken back. */
  | "risky"
  /** More Cells than the person's cap. */
  | "over-cap"
  /** Some of the message was given to no one. */
  | "left-over"
  /** The message also deletes something: that is dealt with first. */
  | "after-hold"
  /** The person checks every plan. */
  | "always"
  /** Aski's chat proposed it; the words are Aski's. */
  | "proposed";

/** A risky phrase in a Cell's words, by offsets into `words`. */
export interface RiskMark {
  readonly start: number;
  readonly end: number;
  readonly kind: RiskKind;
}

interface ActBase {
  /** Its place in the plan, from 0. */
  readonly i: number;
  readonly pieces: readonly number[];
  readonly tier: Tier;
  readonly why: readonly Why[];
}

/** A Cell to start. */
export interface StartAct extends ActBase {
  readonly kind: "start";
  /** The thread the Cell will be, minted with the plan, so its name is known before it exists. */
  readonly threadId: string;
  /** At most six words. */
  readonly title: string;
  /** What the Cell is told: the person's own words, or Aski's when `why` has `proposed`. */
  readonly words: string;
  /** A fixed line from code after the words (a dictated message says so); null for none. */
  readonly note: string | null;
  /** Null while no project is known: the person picks one. */
  readonly place: PlaceField | null;
  /** Null for the project's default. */
  readonly model: ModelField | null;
  /** The model as Aski's chat named it, whole, for a plan it proposed; a launch sends it as it is. */
  readonly selection?: Selection;
  /** The level the person said, kept for a default model whose ladder the client knows. */
  readonly effort: string | null;
  readonly risks: readonly RiskMark[];
  /**
   * The acts (by `i`) whose Cells must land before this one starts, when the person said so
   * (decision 16); absent for none. `afterHeard` is their words for it.
   */
  readonly after?: readonly number[];
  readonly afterHeard?: string;
  /**
   * Where it works, when the person said: true in a worktree of its own, false in the project's
   * folder (decision 17); absent for the project's default.
   */
  readonly apart?: boolean;
}

/** A project to delete, or Cells to archive. Always a hold. */
export interface DestroyAct extends ActBase {
  readonly kind: "destroy";
  readonly target: "project" | "cells";
  /** The project, for either target: the one to delete, or the one whose Cells go. */
  readonly place: PlaceField | null;
  /** The Cells named, for `cells` with no project. */
  readonly cells: readonly LiveCell[];
  /** The person's words for it. */
  readonly words: string;
}

export type Act = StartAct | DestroyAct;

export interface Plan {
  readonly id: string;
  readonly dictated: boolean;
  readonly pieces: readonly Piece[];
  readonly acts: readonly Act[];
  /** Pieces that are talk: a question, a setting, a word to a running Cell. They go to Aski's chat. */
  readonly talk: readonly number[];
  /** Pieces no act took and that are neither setup nor talk. */
  readonly leftOver: readonly number[];
  /**
   * `read`: the compiler's answer passed the checks. `floor`: it couldn't be read, nothing
   * starts, and the message goes to Aski's chat as it is. `proposed`: Aski's chat made it.
   */
  readonly from: "read" | "floor" | "proposed";
}

/** The line a dictated message's Cell reads after its words. */
export const DICTATED_NOTE =
  "(The person dictated this. A name or a word may be misheard: ask before guessing.)";

/** What a Cell's first message says. */
export const messageOf = (act: Pick<StartAct, "words" | "note">): string =>
  act.note === null ? act.words : `${act.words}\n\n${act.note}`;

/** Whether anything in the plan starts, waits or holds: a plan with none is only talk. */
export const hasActs = (plan: Plan): boolean => plan.acts.length > 0;
