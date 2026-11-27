// The names Aski has learned from the person's own confirms (stemcells/tasks/aski-orchestrator.md,
// decision 13): "harbour" is Harbor, "table" is Fable. Kept in one small file in the app's own
// data folder, on this machine; the next message that says the word is read exactly.

import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Path from "effect/Path";
import * as Schema from "effect/Schema";

import { mishearingOf, modelSaid, said } from "../../../../../stemcells/orchestrator/names.ts";
import type { CompileContext } from "../../../../../stemcells/orchestrator/plan.ts";

const Heard = Schema.Struct({ heard: Schema.String, name: Schema.String });
export const Learned = Schema.Struct({
  places: Schema.Array(Heard),
  models: Schema.Array(Heard),
});
export type Learned = typeof Learned.Type;

export const NOTHING: Learned = { places: [], models: [] };
/** The most names kept of each kind; the oldest goes first. */
export const LEARNED_MOST = 300;
/** The longest word kept as a name: a name is a word or three. */
const HEARD_MOST = 60;

const decode = Schema.decodeUnknownEffect(Schema.fromJsonString(Learned));
const encode = Schema.encodeEffect(Schema.fromJsonString(Learned));

const fileIn = Effect.fn("AskiLearned.file")(function* (folder: string) {
  const path = yield* Path.Path;
  return path.join(folder, "learned.json");
});

/** What Aski has learned; nothing when the file isn't there or doesn't read. */
export const readLearned = Effect.fn("AskiLearned.read")(function* (folder: string) {
  const fs = yield* FileSystem.FileSystem;
  const file = yield* fileIn(folder);
  return yield* fs.readFileString(file).pipe(
    Effect.flatMap(decode),
    Effect.orElseSucceed(() => NOTHING),
  );
});

/** `known` with `more`: a word heard again takes its newest name, and the oldest go past the most. */
export function withLearned(
  known: ReadonlyArray<{ readonly heard: string; readonly name: string }>,
  more: ReadonlyArray<{ readonly heard: string; readonly name: string }>,
): Array<{ heard: string; name: string }> {
  const out = new Map(known.map((one) => [said(one.heard), one]));
  for (const one of more) {
    const key = said(one.heard);
    // A name said as it is written needs no learning.
    if (key.length === 0 || one.heard.length > HEARD_MOST || key === said(one.name)) continue;
    out.delete(key);
    out.set(key, { heard: one.heard.trim(), name: one.name });
  }
  return [...out.values()].slice(-LEARNED_MOST);
}

export const learn = Effect.fn("AskiLearned.learn")(function* (folder: string, more: Learned) {
  const fs = yield* FileSystem.FileSystem;
  const known = yield* readLearned(folder);
  // A client's word for it isn't enough: only a mishearing of the name itself is kept.
  const next: Learned = {
    places: withLearned(
      known.places,
      more.places.filter((one) => mishearingOf(one.heard, [one.name])),
    ),
    models: withLearned(
      known.models,
      more.models.filter((one) => mishearingOf(one.heard, modelSaid(one.name))),
    ),
  };
  yield* fs.makeDirectory(folder, { recursive: true });
  yield* fs.writeFileString(yield* fileIn(folder), yield* encode(next));
  return next;
});

export const forget = Effect.fn("AskiLearned.forget")(function* (folder: string) {
  const fs = yield* FileSystem.FileSystem;
  yield* fs.remove(yield* fileIn(folder), { force: true });
});

/** `context` with what was learned added to each place's and model's other names. */
export function withNames(context: CompileContext, learned: Learned): CompileContext {
  const also = (list: Learned["places"], name: string) =>
    list.filter((one) => said(one.name) === said(name)).map((one) => one.heard);
  return {
    ...context,
    places: context.places.map((place) => {
      const more = also(learned.places, place.name);
      return more.length === 0 ? place : { ...place, aliases: [...(place.aliases ?? []), ...more] };
    }),
    models: context.models.map((model) => {
      const more = also(learned.models, model.name);
      return more.length === 0 ? model : { ...model, aliases: [...(model.aliases ?? []), ...more] };
    }),
  };
}
