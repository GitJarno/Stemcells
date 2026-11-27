import * as Schema from "effect/Schema";

/**
 * What Aski's compiler answers (stemcells/tasks/aski-orchestrator.md, decision 3): which
 * pieces of the message belong to which act, and the names it read. It writes none of a Cell's
 * words. `stemcells/orchestrator/check.ts` checks every field before anything becomes a plan.
 */
export const CompilerAnswer = Schema.Struct({
  acts: Schema.Array(
    Schema.Struct({
      kind: Schema.Literals(["start", "new", "destroy"]),
      pieces: Schema.Array(Schema.Number),
      place: Schema.optionalKey(Schema.String),
      placeHeard: Schema.optionalKey(Schema.String),
      model: Schema.optionalKey(Schema.String),
      modelHeard: Schema.optionalKey(Schema.String),
      effort: Schema.optionalKey(Schema.String),
      count: Schema.optionalKey(Schema.Number),
      title: Schema.optionalKey(Schema.String),
      target: Schema.optionalKey(Schema.Literals(["project", "cells"])),
      cells: Schema.optionalKey(Schema.Array(Schema.String)),
    }),
  ),
  setup: Schema.Array(Schema.Number),
  talk: Schema.Array(Schema.Number),
});

export type CompilerAnswer = typeof CompilerAnswer.Type;
