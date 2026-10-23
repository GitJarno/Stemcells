/**
 * What Settings › Lineage's spend takes from upstream: the tokens each
 * provider turn reported, as the orchestrator stores them on the turn
 * (`turnTokenUsage`, the main agent's), the model its run asked for, and the
 * usage page's price table and the person's price settings. Read only:
 * nothing here writes, and no transcript is opened.
 */
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Path from "effect/Path";
import * as Schema from "effect/Schema";
import * as SqlClient from "effect/sql/SqlClient";

import * as ServerConfig from "../../config.ts";
import * as ServerSettings from "../../serverSettings.ts";
import { resolveModelAliases } from "../../usage/usageAggregation.ts";
import {
  createOverrideRateTable,
  parseRateTable,
  priceUsage,
  type RateTable,
} from "../../usage/usagePricing.ts";
import * as UsageService from "../../usage/UsageService.ts";

/** One thread's turns on one model and speed, summed. */
export interface SpendRow {
  readonly threadId: string;
  /** Null when the turn's run is gone or never named a model. */
  readonly model: string | null;
  readonly fast: boolean;
  /** Input counts cache reads and writes; output counts reasoning. */
  readonly inputTokens: number;
  readonly cachedInputTokens: number;
  readonly cacheCreationTokens: number;
  readonly outputTokens: number;
  readonly reasoningTokens: number;
  readonly turns: number;
  /** Turns whose provider gave no count, or only part of one. */
  readonly uncountedTurns: number;
  /** Turns that ran subagents, whose own tokens the count leaves out. */
  readonly subagentTurns: number;
}

const usage = (field: string) => `json_extract(turn.payload_json, '$.turnTokenUsage.${field}')`;

/**
 * Every thread's turns, summed by model and speed, and when the first counted
 * turn started. One indexed pass over the turns: the page asks once as it opens.
 */
export const readSpendRows = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  const rows = yield* sql<{
    readonly threadId: string;
    readonly model: string | null;
    readonly fast: number;
    readonly inputTokens: number;
    readonly cachedInputTokens: number;
    readonly cacheCreationTokens: number;
    readonly outputTokens: number;
    readonly reasoningTokens: number;
    readonly turns: number;
    readonly uncountedTurns: number;
    readonly subagentTurns: number;
    readonly firstStartedAt: string | null;
  }>`
    WITH counted AS (
      SELECT
        turn.thread_id AS thread_id,
        json_extract(run.payload_json, '$.modelSelection.model') AS model,
        EXISTS (
          SELECT 1 FROM json_each(run.payload_json, '$.modelSelection.options') AS option
          WHERE json_extract(option.value, '$.id') = 'fastMode'
            AND json_extract(option.value, '$.value') = 1
        ) AS fast,
        coalesce(${sql.unsafe(usage("inputTokens"))}, 0) AS input_tokens,
        coalesce(${sql.unsafe(usage("cachedInputTokens"))}, 0) AS cached_input_tokens,
        coalesce(${sql.unsafe(usage("cacheCreationTokens"))}, 0) AS cache_creation_tokens,
        coalesce(${sql.unsafe(usage("outputTokens"))}, 0) AS output_tokens,
        coalesce(${sql.unsafe(usage("reasoningTokens"))}, 0) AS reasoning_tokens,
        coalesce(${sql.unsafe(usage("usageStatus"))}, 'unavailable') <> 'complete' AS uncounted,
        coalesce(${sql.unsafe(usage("hasSubagents"))}, 0) = 1 AS subagents,
        turn.started_at AS started_at
      FROM orchestration_v2_projection_provider_turns AS turn
      LEFT JOIN orchestration_v2_projection_run_attempts AS attempt
        ON attempt.attempt_id = turn.run_attempt_id
      LEFT JOIN orchestration_v2_projection_runs AS run
        ON run.run_id = attempt.run_id
      WHERE turn.status IN ('completed', 'interrupted', 'failed', 'cancelled')
    )
    SELECT
      thread_id AS "threadId",
      model,
      fast,
      sum(input_tokens) AS "inputTokens",
      sum(cached_input_tokens) AS "cachedInputTokens",
      sum(cache_creation_tokens) AS "cacheCreationTokens",
      sum(output_tokens) AS "outputTokens",
      sum(reasoning_tokens) AS "reasoningTokens",
      count(*) AS turns,
      sum(uncounted) AS "uncountedTurns",
      sum(subagents) AS "subagentTurns",
      min(started_at) AS "firstStartedAt"
    FROM counted
    GROUP BY thread_id, model, fast
  `;
  const firstStarted = rows
    .map((row) => row.firstStartedAt)
    .filter((at): at is string => at !== null)
    .toSorted()[0];
  return {
    since: firstStarted ?? null,
    rows: rows.map(({ firstStartedAt: _first, fast, ...row }): SpendRow => ({
      ...row,
      fast: fast === 1,
    })),
  };
});

const RatesCacheFile = Schema.fromJsonString(Schema.Struct({ document: Schema.Unknown }));
const decodeRatesCache = Schema.decodeUnknownEffect(RatesCacheFile);

/** How the person prices models: the usage page's table, their own prices and aliases. */
export interface Pricing {
  readonly rates: RateTable;
  readonly overrides: RateTable;
  readonly aliases: ReadonlyMap<string, string>;
}

/**
 * The price table the usage page keeps in the state folder. When the page has
 * never fetched it, it is fetched once, as the usage page would; without it
 * every model reads as unpriced and the tokens still show.
 */
export const readPricing = Effect.gen(function* () {
  const fileSystem = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const config = yield* ServerConfig.ServerConfig;
  const settings = yield* ServerSettings.ServerSettingsService;
  const usageService = yield* UsageService.UsageService;

  const cachePath = path.join(config.stateDir, "usage-model-rates.json");
  const fromDisk = fileSystem.readFileString(cachePath).pipe(
    Effect.flatMap(decodeRatesCache),
    Effect.map((cache) => parseRateTable(cache.document)),
    Effect.catchCause(() => Effect.succeed<RateTable>(new Map())),
  );
  let rates = yield* fromDisk;
  if (rates.size === 0) {
    yield* usageService.refreshRates;
    rates = yield* fromDisk;
  }
  const current = yield* settings.getSettings.pipe(Effect.option);
  return {
    rates,
    overrides: createOverrideRateTable(
      current._tag === "Some" ? current.value.usagePriceOverrides : {},
    ),
    aliases: resolveModelAliases(current._tag === "Some" ? current.value.usageModelAliases : {}),
  } satisfies Pricing;
});

/** What `row`'s tokens cost at list price, or null when its model has no price. */
export function costOf(pricing: Pricing, row: SpendRow): number | null {
  if (row.model === null) return null;
  const model = pricing.aliases.get(row.model) ?? row.model;
  const cached = Math.min(row.cachedInputTokens, row.inputTokens);
  const priced = priceUsage(
    pricing.rates,
    {
      model,
      totals: {
        uncachedInputTokens: Math.max(0, row.inputTokens - cached - row.cacheCreationTokens),
        cachedInputTokens: cached,
        cacheCreationTokens: row.cacheCreationTokens,
        outputTokens: row.outputTokens,
        reasoningTokens: row.reasoningTokens,
      },
      speed: row.fast ? "fast" : "standard",
      reportedCostUsd: null,
    },
    pricing.overrides,
  );
  return priced.costSource === "unpriced" ? null : priced.costUsd;
}
