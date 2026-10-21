import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Path from "effect/Path";
import * as Schema from "effect/Schema";

// The plan history (stemcells/tasks/prompting.md, decision 19): every plan,
// one line each, in a file per day in the app's own data folder. It is
// never sent anywhere, and a day's file goes once it is 30 days old.
// `scripts/aski-eval --harvest` reads it from disk.

/** How long a plan is kept, in days. */
export const HISTORY_DAYS = 30;

const DAY_FILE = /^(\d{4}-\d{2}-\d{2})\.jsonl$/;

/** One plan as the history keeps it: any JSON object. */
export const PlanRecord = Schema.Record(Schema.String, Schema.Unknown);
export type PlanRecord = typeof PlanRecord.Type;
const encodeLine = Schema.encodeEffect(Schema.fromJsonString(PlanRecord));

const isoOf = (now: number) => DateTime.formatIso(DateTime.makeUnsafe(now));

/** The day file a plan made at `now` (epoch ms) goes in: "2026-10-21.jsonl", by UTC. */
export function dayFile(now: number): string {
  return `${isoOf(now).slice(0, 10)}.jsonl`;
}

/** Of `names` in the history folder, the day files older than `HISTORY_DAYS` at `now`. */
export function staleFiles(names: ReadonlyArray<string>, now: number): string[] {
  const oldest = dayFile(now - HISTORY_DAYS * 24 * 60 * 60 * 1000);
  return names.filter((name) => {
    const day = DAY_FILE.exec(name)?.[1];
    return day !== undefined && `${day}.jsonl` < oldest;
  });
}

/** Adds one plan to the history at `now`, and lets go of the days past keeping. */
export const appendPlan = Effect.fn("PlanHistory.append")(function* (
  folder: string,
  plan: PlanRecord,
  now: number,
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  yield* fs.makeDirectory(folder, { recursive: true });
  const line = yield* encodeLine({ at: isoOf(now), ...plan });
  yield* fs.writeFileString(path.join(folder, dayFile(now)), `${line}\n`, { flag: "a" });
  const names = yield* fs.readDirectory(folder);
  for (const name of staleFiles(names, now)) yield* fs.remove(path.join(folder, name));
});

/** Forgets every plan (Settings › Aski). */
export const clearPlans = Effect.fn("PlanHistory.clear")(function* (folder: string) {
  const fs = yield* FileSystem.FileSystem;
  if (yield* fs.exists(folder)) yield* fs.remove(folder, { recursive: true });
});
