import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Schema from "effect/Schema";

// How little free space warns the person about this machine's disk: their choice, kept in our
// state folder. Clients read it beside the disk's figures (`server.getHostResources`); the
// phone's disk card and Settings › Disk change it (`POST /api/stemcells/disk/warn`).

/** Under 1 GB the disk is already full; over 1 TB it would warn about every disk. */
export const WarnBelow = Schema.Int.check(
  Schema.isBetween({ minimum: 1_000_000_000, maximum: 1_000_000_000_000 }),
);

const Choice = Schema.fromJsonString(Schema.Struct({ warnBelow: WarnBelow }));
const decodeChoice = Schema.decodeUnknownEffect(Choice);
const encodeChoice = Schema.encodeEffect(Choice);

export const warnFile = (stateDir: string) => `${stateDir}/stemcells/disk.json`;

/** The person's choice, or null: never made, or a file that won't read. */
export const readWarnBelow = Effect.fn("DiskWarn.read")(function* (file: string) {
  const fs = yield* FileSystem.FileSystem;
  const text = yield* fs.readFileString(file).pipe(Effect.orElseSucceed(() => null));
  if (text === null) return null;
  return yield* decodeChoice(text).pipe(
    Effect.map((choice) => choice.warnBelow),
    Effect.orElseSucceed(() => null),
  );
});

/** Keeps `warnBelow` as the choice, written beside and renamed into place. */
export const writeWarnBelow = Effect.fn("DiskWarn.write")(function* (
  file: string,
  warnBelow: number,
) {
  const fs = yield* FileSystem.FileSystem;
  yield* fs.makeDirectory(file.slice(0, file.lastIndexOf("/")), { recursive: true });
  const temporary = `${file}.tmp`;
  yield* fs.writeFileString(temporary, yield* encodeChoice({ warnBelow }));
  yield* fs.rename(temporary, file);
});
