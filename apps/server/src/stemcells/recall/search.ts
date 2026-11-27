/**
 * A question read into a search, and its matches put in order (stemcells/tasks/
 * aski-orchestrator.md, decision 8): the project and the time are filters, then the nearest to
 * the words first, the newest first among the equally near. Pure.
 */
import { hearName } from "../../../../../stemcells/recall/byEar.ts";
import type { RecallState } from "../../../../../stemcells/recall/card.ts";
import { cut, FILLER, freeWords } from "../../../../../stemcells/recall/question.ts";
import { readWhen } from "../../../../../stemcells/recall/when.ts";
import { matchOf, type Hit, type StoreQuery } from "./store.ts";

export interface Project {
  readonly id: string;
  readonly title: string;
}

export interface Asked {
  /** The person's words, as said. */
  readonly query: string;
  /** A window already read, by a client's own clock; else the words' time is read here. */
  readonly from: number | null;
  readonly to: number | null;
  /** A project named apart from the words, by ear as any. */
  readonly project: string | null;
  readonly state: RecallState;
}

export interface Reading {
  readonly store: StoreQuery;
  readonly project: Project | null;
  readonly words: ReadonlyArray<string>;
}

/**
 * The search a question asks for, among `projects`: `scope`, when given, is the projects the
 * asker may read, and a project heard outside it is not heard. Null when the question names
 * nothing to search by: no time, no project, no word.
 */
export function readingOf(
  asked: Asked,
  projects: ReadonlyArray<Project>,
  now: number,
  scope: ReadonlySet<string> | null = null,
): Reading | null {
  const reach = scope === null ? projects : projects.filter((project) => scope.has(project.id));
  const names = reach.map((project) => ({ item: project, name: project.title }));
  const when = readWhen(asked.query, now);
  const timeless = cut(asked.query, when);
  const named = asked.project === null ? null : hearName(asked.project, names);
  const heard = named === null ? hearName(timeless, names, FILLER) : null;
  const found = named?.item ?? heard?.item ?? null;
  const project = found === null ? null : { id: found.id, title: found.title };
  const words = freeWords(cut(timeless, heard));
  const windowed = asked.from !== null || asked.to !== null;
  const from = windowed ? asked.from : (when?.from ?? null);
  const to = windowed ? asked.to : (when?.to ?? null);
  if (words.length === 0 && project === null && from === null && to === null) return null;
  return {
    store: {
      match: matchOf(words),
      from,
      to,
      projectIds:
        project !== null ? [project.id] : scope === null ? null : reach.map((each) => each.id),
      awake: asked.state === "both" ? null : asked.state === "awake",
    },
    project,
    words,
  };
}

/** Matches within a tenth of the nearest's score of each other are as near: the newer first. */
const STEPS = 10;

/**
 * The matches in order: the nearest to the words first, the newest among the equally near.
 * Nearness is told against the nearest match, since bm25's own size changes with the corpus.
 */
export function ranked(hits: ReadonlyArray<Hit>): ReadonlyArray<Hit> {
  const nearest = Math.min(0, ...hits.map((hit) => hit.score));
  const near = (hit: Hit) => (nearest === 0 ? 0 : Math.round((hit.score / nearest) * STEPS));
  return [...hits].sort((a, b) => near(b) - near(a) || b.touchedAt - a.touchedAt);
}
