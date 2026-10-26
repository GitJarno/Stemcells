import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Path from "effect/Path";
import * as Schema from "effect/Schema";

import * as ServerConfig from "../../config.ts";
import { EMPTY, Ledger } from "../asks/ledger.ts";

// What the asks' ledger takes from upstream: the state folder our own records live in.

const decodeLedger = Schema.decodeUnknownEffect(Schema.fromJsonString(Ledger));
const encodeLedger = Schema.encodeEffect(Schema.fromJsonString(Ledger));

/** The ledger's file, `asks.json` in our state folder: kept on this Mac, never sent anywhere. */
export const makeLedgerFile = Effect.gen(function* () {
  const config = yield* ServerConfig.ServerConfig;
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const folder = path.join(config.stateDir, "stemcells");
  const file = path.join(folder, "asks.json");

  // No file yet is a fresh start; one that won't read is said so before it is replaced.
  const load = fs.readFileString(file).pipe(
    Effect.orElseSucceed(() => null),
    Effect.flatMap((text) =>
      text === null
        ? Effect.succeed(EMPTY)
        : decodeLedger(text).pipe(
            Effect.catchCause((cause) =>
              Effect.logWarning("The asks' ledger didn't read; starting afresh", cause).pipe(
                Effect.as(EMPTY),
              ),
            ),
          ),
    ),
  );

  // Written beside and renamed into place: a crash mid-write leaves the last whole file.
  const save = Effect.fn("UpstreamAsks.save")(
    function* (ledger: Ledger) {
      yield* fs.makeDirectory(folder, { recursive: true });
      const temporary = `${file}.tmp`;
      yield* fs.writeFileString(temporary, yield* encodeLedger(ledger));
      yield* fs.rename(temporary, file);
    },
    Effect.catchCause((cause) => Effect.logWarning("Couldn't keep the asks' ledger", cause)),
  );

  return { load, save };
});
