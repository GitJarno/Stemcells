// @effect-diagnostics globalDate:off - the ledger's hours are this machine's local time, and
// the import script runs this with plain Node, without Effect.
import type { UsageProviderKind } from "@t3tools/contracts";
import type { UsageRecord } from "@t3tools/provider-core/server/usage";

// Usage kept from transcripts the provider CLIs have since deleted: Claude keeps a transcript
// about 30 days and the Usage page's cache 92, so older months would read as nothing. No Effect
// here, so `stemcells/scripts/import-usage-ledger` can run it with plain Node to import
// another app's ledger once.

/** One transcript's tokens by hour and model. */
export interface HistoryFile {
  readonly provider: UsageProviderKind;
  readonly session: string;
  /** `[hour start (epoch ms), model, uncached input, cache read, cache write, output]`. */
  readonly rows: ReadonlyArray<readonly [number, string, number, number, number, number]>;
}

/** Keyed by the transcript's path, the identity the Usage page's own cache uses. */
export interface HistoryStore {
  readonly version: 1;
  readonly files: Readonly<Record<string, HistoryFile>>;
}

export const HISTORY_FILE_NAME = "usage-history.json";

const PROVIDERS: Readonly<Record<string, UsageProviderKind>> = {
  "claude-code": "claude",
  codex: "codex",
};

const count = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) && value > 0 ? Math.trunc(value) : 0;

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** `yyyy-MM-ddTHH`, a local clock hour as the ledger writes it, to its start. */
function localHourStart(key: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2})$/.exec(key);
  if (match === null) return null;
  const [, year, month, day, hour] = match.map(Number);
  return new Date(year!, month! - 1, day!, hour!).getTime();
}

/**
 * An earlier app's usage ledger (version 1)
 * as a store. Its counts are Anthropic-shaped already: `i` is the uncached
 * input, `r` cache reads, `w` every cache write, `o` output. Hours are read in
 * this machine's time zone, the one the ledger wrote them in.
 */
export function fromLedger(ledger: unknown): HistoryStore {
  if (!isObject(ledger) || ledger["version"] !== 1 || !isObject(ledger["records"])) {
    throw new Error("Not a usage ledger (version 1).");
  }
  const files: Record<string, HistoryFile> = {};
  for (const record of Object.values(ledger["records"])) {
    if (!isObject(record) || !isObject(record["buckets"])) continue;
    const provider = PROVIDERS[String(record["provider"])];
    const path = record["path"];
    const session = record["session"];
    if (provider === undefined || typeof path !== "string" || typeof session !== "string") continue;
    const rows: Array<readonly [number, string, number, number, number, number]> = [];
    for (const [key, counts] of Object.entries(record["buckets"])) {
      const bar = key.indexOf("|");
      const hour = bar < 0 ? null : localHourStart(key.slice(0, bar));
      if (hour === null || !isObject(counts)) continue;
      const row = [
        hour,
        key.slice(bar + 1),
        count(counts["i"]),
        count(counts["r"]),
        count(counts["w"]),
        count(counts["o"]),
      ] as const;
      if (row[2] + row[3] + row[4] + row[5] > 0) rows.push(row);
    }
    if (rows.length > 0)
      files[path] = { provider, session, rows: rows.toSorted((a, b) => a[0] - b[0]) };
  }
  return { version: 1, files };
}

/** `incoming` over `existing`: a transcript the new ledger no longer names keeps its numbers. */
export function mergeStores(existing: HistoryStore | null, incoming: HistoryStore): HistoryStore {
  return { version: 1, files: { ...existing?.files, ...incoming.files } };
}

export function parseStore(raw: string): HistoryStore | null {
  const parsed: unknown = JSON.parse(raw);
  return isObject(parsed) && parsed["version"] === 1 && isObject(parsed["files"])
    ? (parsed as unknown as HistoryStore)
    : null;
}

/** What the Usage page already counts from its own scan of the transcripts. */
export interface HeldUsage {
  readonly paths: ReadonlySet<string>;
  /** Codex moves a rollout to its archive, so a session is held under a new path too. */
  readonly codexSessions: ReadonlySet<string>;
}

/** The store's transcripts the Usage page holds no copy of, by provider, as its records. */
export function unheldRecords(
  store: HistoryStore,
  held: HeldUsage,
): ReadonlyMap<UsageProviderKind, ReadonlyArray<{ path: string; records: UsageRecord[] }>> {
  const byProvider = new Map<UsageProviderKind, Array<{ path: string; records: UsageRecord[] }>>();
  for (const [path, file] of Object.entries(store.files)) {
    if (held.paths.has(path)) continue;
    if (file.provider === "codex" && held.codexSessions.has(file.session)) continue;
    const records = file.rows.map(
      ([timestampMs, model, uncached, cached, written, output]): UsageRecord => ({
        provider: file.provider,
        timestampMs,
        model,
        sessionId: file.session,
        totals: {
          uncachedInputTokens: uncached,
          cachedInputTokens: cached,
          cacheCreationTokens: written,
          outputTokens: output,
          reasoningTokens: 0,
        },
        reportedCostUsd: null,
        speed: "standard",
        dedupeKey: null,
      }),
    );
    const files = byProvider.get(file.provider) ?? [];
    files.push({ path, records });
    byProvider.set(file.provider, files);
  }
  return byProvider;
}
