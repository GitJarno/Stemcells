/**
 * Where the Usage page takes in the usage history (`stemcells/usageHistory`):
 * one more source per provider beside its transcript directories, holding
 * only the transcripts its own scan and cache no longer have, so nothing
 * counts twice. A seam in `usage/UsageService.ts`'s `collectDirs` calls it.
 */
import type { UsageProviderKind } from "@t3tools/contracts";
import type { UsageRecord } from "@t3tools/provider-core/server/usage";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import type * as FileSystem from "effect/FileSystem";
import type * as Path from "effect/Path";

import type { ScanCache } from "../../usage/usageScanCache.ts";
import {
  HISTORY_FILE_NAME,
  type HistoryStore,
  parseStore,
  unheldRecords,
} from "../usageHistory/history.ts";

/** The parsed store, kept while the file is unchanged: the page reads usage often. */
let memo: { readonly key: string; readonly store: HistoryStore | null } | null = null;

const readStore = Effect.fn("UsageHistory.readStore")(
  function* (fileSystem: FileSystem.FileSystem, file: string) {
    const stat = yield* fileSystem.stat(file);
    const key = `${file}\0${stat.mtime.pipe(Option.getOrUndefined)?.getTime()}\0${stat.size}`;
    if (memo?.key !== key) {
      memo = { key, store: parseStore(yield* fileSystem.readFileString(file)) };
    }
    return memo.store;
  },
  // No history yet, or one that does not parse: the page counts its own scan.
  Effect.catchCause(() => Effect.succeed(null)),
);

/**
 * The history's sources, in `collectDirs`' own shape. `live` is what this scan
 * read; a cached transcript counts as held on the terms the page keeps it by,
 * a write since the window opened and inside its retention.
 */
export const usageHistory = Effect.fn("UsageHistory.sources")(function* (input: {
  readonly fileSystem: FileSystem.FileSystem;
  readonly path: Path.Path;
  readonly stateDir: string;
  readonly live: ReadonlyArray<{ readonly files: ReadonlyArray<{ readonly path: string }> | null }>;
  readonly cache: ScanCache;
  readonly windowStartMs: number;
  readonly retentionCutoffMs: number;
}) {
  const { fileSystem, path } = input;
  const dir = path.join(input.stateDir, "stemcells", HISTORY_FILE_NAME);
  const store = yield* readStore(fileSystem, dir);
  if (store === null) return [];

  const retainedSinceMs = Math.max(input.windowStartMs, input.retentionCutoffMs);
  const paths = new Set(
    input.live.flatMap((source) => source.files?.map((file) => file.path) ?? []),
  );
  const codexSessions = new Set<string>();
  for (const [file, entry] of input.cache) {
    if (entry.mtimeMs < retainedSinceMs) continue;
    paths.add(file);
    if (entry.provider !== "codex") continue;
    const session = (entry.records[0] ?? entry.tailRecords[0])?.sessionId;
    if (session) codexSessions.add(session);
  }

  // The page reads transcripts through their real path; the store keeps the
  // one its ledger saw, which a symlinked folder can make differ.
  const realDirs = new Map<string, string>();
  for (const file of Object.keys(store.files)) {
    if (paths.has(file)) continue;
    const parent = path.dirname(file);
    let real = realDirs.get(parent);
    if (real === undefined) {
      real = yield* fileSystem.realPath(parent).pipe(Effect.orElseSucceed(() => parent));
      realDirs.set(parent, real);
    }
    if (paths.has(path.join(real, path.basename(file)))) paths.add(file);
  }

  return [...unheldRecords(store, { paths, codexSessions })].map(
    ([provider, files]): {
      readonly provider: UsageProviderKind;
      readonly dir: string;
      readonly volumeId: string;
      readonly files: ReadonlyArray<{
        readonly path: string;
        readonly records: readonly UsageRecord[];
        readonly malformedRecords: number;
      }>;
    } => ({
      provider,
      dir,
      volumeId: "stemcells-usage-history",
      files: files.map((file) => ({ ...file, malformedRecords: 0 })),
    }),
  );
});
