import * as Schema from "effect/Schema";

/**
 * What Aski's planner answers (stemcells/tasks/prompting.md, decision 11):
 * only what the words left open, for each numbered Cell. `project` is a
 * roster name, for a Cell whose place is open. Nothing here can change a
 * typed word; the web checks the answer against the facts before any Cell
 * starts.
 */
export const PlanAnswer = Schema.Struct({
  cells: Schema.Array(
    Schema.Struct({
      cell: Schema.Number,
      project: Schema.optionalKey(Schema.String),
      title: Schema.String,
      prompt: Schema.String,
    }),
  ),
});

export type PlanAnswer = typeof PlanAnswer.Type;
