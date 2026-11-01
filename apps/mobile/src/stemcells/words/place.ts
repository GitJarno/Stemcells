// A new chat goes to the project its words name, as on the Mac (`web/.../words/driver.ts`):
// the web's reader finds the name and `follow` decides; this reads the steps onto the phone's
// draft. Only the project follows the words here: the phone sets no model from them.

import {
  choiceOf,
  follow,
  modelLexicon,
  readWords,
  roster,
  type ReadContext,
  type Taken,
} from "./kit";

/** A project as the new chat's picker lists it: its name, and its projects as `environmentId:projectId`. */
export interface Place {
  readonly key: string;
  readonly name: string;
  readonly projects: readonly string[];
}

export interface Places {
  readonly list: readonly Place[];
  readonly ctx: ReadContext;
}

export type Following = Taken<null>;

export const NOTHING_TAKEN: Following = { project: null, model: null };

/** Build once per change to the list; the reader then runs on every keystroke. */
export function placesOf(list: readonly Place[]): Places {
  return {
    list,
    ctx: {
      door: "draft",
      roster: roster(list.map((place) => ({ id: place.key, name: place.name }))),
      // No model is named on the phone, so no model word is known to the reader.
      models: modelLexicon({ providers: [] }),
    },
  };
}

export interface WordsStep {
  readonly taken: Following;
  /** The project to point the draft at, as `environmentId:projectId`. */
  readonly move: string | null;
  /** The text with the person's pick written over the name that set the project. */
  readonly text: string | null;
}

/** What the draft does for `text`, pointed at `current` now. */
export function wordsStep(
  text: string,
  places: Places,
  current: string,
  taken: Following,
): WordsStep {
  // A send empties the draft: what its words set stands, for the next new chat.
  if (text.trim().length === 0) return { taken: NOTHING_TAKEN, move: null, text: null };
  const place = choiceOf(readWords(text, places.ctx))?.place ?? null;
  const environment = current.slice(0, current.indexOf(":"));
  const projects = places.list.find((p) => p.key === place?.place.place.id)?.projects ?? [];
  const key = projects.find((k) => k.startsWith(`${environment}:`)) ?? projects[0];
  // The phone doesn't follow the caret, so a whole name acts at once, never on a timer a send
  // could beat: "Harbor" moves the draft, and "Harbor Design" a moment later moves it on.
  const step = follow(
    taken,
    { project: place && key !== undefined ? { key, word: place } : null, model: null },
    { project: current, model: null },
    () => null,
  );
  let move: string | null = null;
  let written: string | null = null;
  for (const s of step.steps) {
    if (s.kind === "move") move = s.to;
    else if (s.kind === "rewrite-project") {
      const name = places.list.find((p) => p.projects.includes(s.to))?.name;
      if (name !== undefined) written = text.slice(0, s.word.start) + name + text.slice(s.word.end);
    }
  }
  return { taken: step.taken, move, text: written };
}
