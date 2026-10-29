import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import * as Schema from "effect/Schema";

import * as UpstreamDefaults from "../upstream/defaults.ts";

// Upstream's switches Stemcells starts the other way, each applied once per server: a person
// who turns one back keeps it. The settings file keeps only what differs from upstream's
// defaults, so only our record of what we applied tells "set by choice" from "never set".
const DEFAULTS: Readonly<Record<UpstreamDefaults.Switch, boolean>> = {
  // Cells merge their own pull requests: settling at the merge would skip the Landed shelf.
  sidebarAutoSettleOnMerge: false,
  // A limit is the provider's wait, not the person's call (stemcells/tasks/unblocking.md, 1).
  autoResumeLimitedThreads: true,
};

const AppliedDefaults = Schema.fromJsonString(Schema.Record(Schema.String, Schema.String));
const decodeApplied = Schema.decodeUnknownEffect(AppliedDefaults);
const encodeApplied = Schema.encodeEffect(AppliedDefaults);

export const applyDefaults = Effect.fn("Defaults.apply")(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const file = yield* UpstreamDefaults.appliedDefaultsPath;
  // A record that won't read fails here, and the settings stay as they are:
  // never applied twice over a choice the person may have made.
  const applied = (yield* fs.exists(file))
    ? yield* decodeApplied(yield* fs.readFileString(file))
    : {};
  const due = Object.entries(DEFAULTS).filter(([key]) => applied[key] === undefined) as Array<
    [UpstreamDefaults.Switch, boolean]
  >;
  if (due.length === 0) return;

  const at = DateTime.formatIso(yield* DateTime.now);
  const next = { ...applied };
  for (const [key, on] of due) {
    if ((yield* UpstreamDefaults.readSwitch(key)) !== on)
      yield* UpstreamDefaults.setSwitch(key, on);
    next[key] = at;
  }
  const temporary = `${file}.tmp`;
  yield* fs.makeDirectory(path.dirname(file), { recursive: true });
  yield* fs.writeFileString(temporary, yield* encodeApplied(next));
  yield* fs.rename(temporary, file);
});

/** Each default only spares the person a step, so a failure warns and the server starts. */
export const layer = Layer.effectDiscard(
  applyDefaults().pipe(
    Effect.catchCause((cause) =>
      Effect.logWarning("Stemcells: its defaults over upstream's weren't applied", { cause }),
    ),
  ),
);
