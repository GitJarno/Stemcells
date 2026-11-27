// What the compiler's model reads (stemcells/tasks/aski-orchestrator.md, decision 3). It is
// model-facing text: `evals/README.md` applies, and `stemcells/evals/compiler/` scores it.

import type { Piece } from "./pieces.ts";
import type { CompileContext } from "./plan.ts";

/** The most projects named to the model; names are cheap, and a shortlist drops a misheard one. */
const PLACES_MOST = 200;

export const INSTRUCTIONS = `You sort one message from a person into acts for Stemcells, an app that runs coding agents called Cells inside the person's projects. The person often dictates, so words may be misheard and punctuation missing. The message comes cut into numbered pieces. You never rewrite the person's words: you only say which pieces belong to which act. Answer with JSON only.

"acts": one for each Cell the person wants started, each new project, and each thing they want deleted.
- "kind": "start" is a Cell for a task. "new" is a project that doesn't exist yet, with the Cell that starts in it. "destroy" is deleting a project from this app ("target": "project") or archiving Cells ("target": "cells", with "cells": their names from Cells running now, or "place" for every Cell of one project).
- "pieces": the numbers of the pieces that say what this Cell should do. A piece that applies to several Cells goes in each of them.
- "place": the project, written exactly as in Projects. "placeHeard": the word or words of the message you read it from, copied exactly as they stand there, even when misheard ("harbour"). When the person named no project for a Cell, give "place" alone if the task plainly belongs to one listed project, and leave both out if none clearly fits. For "new", "place" and "placeHeard" are the new project's name as the person said it.
- "model": written exactly as in Models, and only when the person asked for one. "modelHeard": the words you read it from, copied exactly ("table" when they meant Fable).
- "effort": the level the person said for this Cell: low, medium, high, xhigh or max.
- A model or an effort said for a group covers each Cell of that group until another is said: "Fable on high, one for A, a second for B, and one Sol for C" is A and B on Fable at high, and C on Sol with no effort.
- "count": only when the person asks for several Cells on the very same task ("3 Cells on this").
- "title": at most six words naming the task.

How many Cells: one for each task the person lists. "One for …, another for …, the second …" are separate Cells, and so are the items of a list. A single task is one Cell however long it is said. Never split one task, never merge two, and never add a Cell for a count the person corrected ("three agents" then two tasks is two).
A correction replaces what it corrects: "the second one, I meant Sol" changes that Cell's model and adds no Cell.

"setup": pieces that only set things up: a model, an effort, a count, "start three agents", "hey can you".
"talk": pieces that ask a question, ask to change a setting, speak to a running Cell by its name, or are chatter. They start nothing.
Every piece number appears in an act, in "setup" or in "talk".

A task that asks a Cell to delete or remove something inside its work (files, a table, a branch, old code) is a "start" with those pieces. "destroy" is only for deleting a project from this app or archiving Cells.`;

/** The compiler's prompt: the pieces, then what the person has. `failed` is a second try's reasons. */
export function compilerPrompt(
  pieces: readonly Piece[],
  context: Pick<CompileContext, "places" | "models" | "cells">,
  failed: readonly string[] = [],
): string {
  const places = context.places.slice(0, PLACES_MOST).map((place) => {
    const also = (place.aliases ?? []).filter((alias) => alias.trim().length > 0);
    return `- ${place.name}${also.length > 0 ? ` (also: ${also.join(", ")})` : ""}`;
  });
  const seen = new Set<string>();
  const models = context.models.flatMap((model) => {
    if (seen.has(model.name)) return [];
    seen.add(model.name);
    const also = [model.provider, ...(model.aliases ?? [])].filter((word) => word.length > 0);
    return [`- ${model.name} (${also.join(", ")})`];
  });
  return [
    INSTRUCTIONS,
    "",
    "Pieces:",
    ...pieces.map((piece) => `${piece.n}. ${piece.text.replace(/\s+/gu, " ")}`),
    "",
    "Projects, most recent first:",
    ...(places.length > 0 ? places : ["(none)"]),
    "",
    "Models:",
    ...(models.length > 0 ? models : ["(none)"]),
    "",
    `Cells running now: ${context.cells.length > 0 ? context.cells.map((cell) => cell.name).join(", ") : "(none)"}`,
    ...(failed.length > 0
      ? ["", "Your last answer failed these checks. Answer again, whole:", ...failed.map((f) => `- ${f}`)]
      : []),
  ].join("\n");
}
