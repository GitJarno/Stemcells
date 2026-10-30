import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Schema from "effect/Schema";
import * as Semaphore from "effect/Semaphore";

import { hideKept } from "../../../../../stemcells/disk/notice.ts";
import { readWarnBelow, warnFile } from "./warn.ts";

// The phone's disk notice, swiped away until the disk has news (`stemcells/disk/notice.ts`): the
// free space it was hidden at, kept beside the warn threshold, so every device hides it. A
// reading of the disk that finds the hide spent, the disk calm again or its news come, forgets it.

export const HiddenAt = Schema.Int.check(Schema.isGreaterThanOrEqualTo(0));

const Hide = Schema.fromJsonString(Schema.Struct({ hiddenAt: HiddenAt }));
const decodeHide = Schema.decodeUnknownEffect(Hide);
const encodeHide = Schema.encodeEffect(Hide);

export const noticeFile = (stateDir: string) => `${stateDir}/stemcells/disk-notice.json`;

/** One change at a time, so forgetting a spent hide never removes one made since. */
const changing = Semaphore.makeUnsafe(1);

/** The free space the notice was hidden at, or null: not hidden, or a file that won't read. */
export const readHiddenAt = Effect.fn("DiskNotice.read")(function* (file: string) {
  const fs = yield* FileSystem.FileSystem;
  const text = yield* fs.readFileString(file).pipe(Effect.orElseSucceed(() => null));
  if (text === null) return null;
  return yield* decodeHide(text).pipe(
    Effect.map((hide) => hide.hiddenAt),
    Effect.orElseSucceed(() => null),
  );
});

/** Hides the notice at `hiddenAt` bytes free, or shows it again (null). */
export const writeHiddenAt = Effect.fn("DiskNotice.write")(function* (
  file: string,
  hiddenAt: number | null,
) {
  const fs = yield* FileSystem.FileSystem;
  if (hiddenAt === null) return yield* fs.remove(file, { force: true });
  yield* fs.makeDirectory(file.slice(0, file.lastIndexOf("/")), { recursive: true });
  const temporary = `${file}.tmp`;
  yield* fs.writeFileString(temporary, yield* encodeHide({ hiddenAt }));
  yield* fs.rename(temporary, file);
}, changing.withPermit);

/** Removes a spent hide, unless the person hid the notice again since. */
const forget = Effect.fn("DiskNotice.forget")(function* (file: string, spent: number) {
  if ((yield* readHiddenAt(file)) !== spent) return;
  const fs = yield* FileSystem.FileSystem;
  yield* fs.remove(file, { force: true });
}, changing.withPermit);

/** The hide as it stands for the disk read now: forgotten, and its file removed, once spent. */
export const keptHiddenAt = Effect.fn("DiskNotice.kept")(function* (
  file: string,
  disk: { readonly free: number; readonly warnBelow: number | null },
) {
  const hiddenAt = yield* readHiddenAt(file);
  if (hiddenAt === null) return null;
  const kept = hideKept({ ...disk, hiddenAt });
  if (kept !== undefined) return kept;
  yield* forget(file, hiddenAt).pipe(
    Effect.catchCause((cause) =>
      Effect.logWarning("Couldn't forget the disk notice's hide", cause),
    ),
  );
  return null;
});

/** What the person chose for the disk read now, in `stateDir`: how little warns, and the hide. */
export const diskChoices = Effect.fn("DiskChoices.read")(function* (
  stateDir: string,
  free: number | undefined,
) {
  const warnBelow = yield* readWarnBelow(warnFile(stateDir));
  const hiddenAt =
    free === undefined ? null : yield* keptHiddenAt(noticeFile(stateDir), { free, warnBelow });
  return { warnBelow, hiddenAt };
});
