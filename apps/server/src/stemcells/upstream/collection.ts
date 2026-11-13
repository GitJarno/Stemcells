import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Path from "effect/Path";
import * as Schema from "effect/Schema";

import * as ServerConfig from "../../config.ts";
import { EMPTY, Kept } from "../collection/kept.ts";

// What the collection takes from upstream: the state folder our own records live in.

const decodeKept = Schema.decodeUnknownEffect(Schema.fromJsonString(Kept));
const encodeKept = Schema.encodeEffect(Schema.fromJsonString(Kept));

/** The collection's file, `collection.json` in our state folder: kept on this machine, never sent anywhere. */
export const makeCollectionFile = Effect.gen(function* () {
  const config = yield* ServerConfig.ServerConfig;
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const folder = path.join(config.stateDir, "stemcells");
  const file = path.join(folder, "collection.json");

  // No file yet is a fresh start; one that won't read is said so before it is replaced.
  const load = fs.readFileString(file).pipe(
    Effect.orElseSucceed(() => null),
    Effect.flatMap((text) =>
      text === null
        ? Effect.succeed(EMPTY)
        : decodeKept(text).pipe(
            Effect.catchCause((cause) =>
              Effect.logWarning("The collection didn't read; starting afresh", cause).pipe(
                Effect.as(EMPTY),
              ),
            ),
          ),
    ),
  );

  // Written beside and renamed into place: a crash mid-write leaves the last whole file.
  const save = Effect.fn("UpstreamCollection.save")(
    function* (kept: Kept) {
      yield* fs.makeDirectory(folder, { recursive: true });
      const temporary = `${file}.tmp`;
      yield* fs.writeFileString(temporary, yield* encodeKept(kept));
      yield* fs.rename(temporary, file);
    },
    Effect.catchCause((cause) => Effect.logWarning("Couldn't keep the collection", cause)),
  );

  return { load, save };
});
