import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import * as Schema from "effect/Schema";

import * as UpstreamSettle from "../upstream/settle.ts";

// Upstream settles a thread as soon as its pull request merges, on by
// default. Cells merge their own pull requests, so a finished Cell would
// skip the Landed shelf, where the person sees what landed, and go straight
// to Settled. Stemcells turns it off once per server and never again: a
// person who turns it back on keeps it on. The settings file keeps only what
// differs from upstream's defaults, so "on by choice" and "never set" read
// the same there; our own record of what we applied tells them apart.
// Settling after idle days, and each project's own choice, stay upstream's.

const KEY = "sidebarAutoSettleOnMerge";

const AppliedDefaults = Schema.fromJsonString(Schema.Record(Schema.String, Schema.String));
const decodeApplied = Schema.decodeUnknownEffect(AppliedDefaults);
const encodeApplied = Schema.encodeEffect(AppliedDefaults);

export const applyMergeDefault = Effect.fn("MergeDefault.apply")(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const file = yield* UpstreamSettle.appliedDefaultsPath;
  // A record that won't read fails here, and the setting stays as it is:
  // never applied twice over a choice the person may have made.
  const applied = (yield* fs.exists(file))
    ? yield* decodeApplied(yield* fs.readFileString(file))
    : {};
  if (applied[KEY] !== undefined) return;

  if (yield* UpstreamSettle.settlesOnMerge) yield* UpstreamSettle.setSettleOnMerge(false);

  const at = DateTime.formatIso(yield* DateTime.now);
  const temporary = `${file}.tmp`;
  yield* fs.makeDirectory(path.dirname(file), { recursive: true });
  yield* fs.writeFileString(temporary, yield* encodeApplied({ ...applied, [KEY]: at }));
  yield* fs.rename(temporary, file);
});

/** Upstream's default only settles Cells early, so a failure warns and the server starts. */
export const layer = Layer.effectDiscard(
  applyMergeDefault().pipe(
    Effect.catchCause((cause) =>
      Effect.logWarning("Stemcells: settling on merge not turned off", { cause }),
    ),
  ),
);
