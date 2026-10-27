/**
 * What the arcs read from upstream's projection, from a given time: each Cell's runs with the
 * reply that ended them, the person's own messages (not the server's in their name, as a card
 * Aski took, nor a scheduled task's), and its requests. Top-level Cells only, not Aski's chat
 * or a subagent's thread. Read only; a transcript is read for its last reply alone.
 */
import * as NodeSqliteClient from "@t3tools/shared/nodeSqliteClient";
import * as Effect from "effect/Effect";
import * as SqlClient from "effect/sql/SqlClient";

import { ASKI_INSTANCE_ID } from "../needs/derive.ts";

export interface ArcRun {
  readonly threadId: string;
  readonly requestedAt: string;
  readonly completedAt: string | null;
  readonly status: string;
  /** The last assistant message of the run, where the Cell said where it stands. */
  readonly reply: string | null;
}

export interface ArcTurn {
  readonly threadId: string;
  /** When the person's message was made. */
  readonly at: string;
}

export interface ArcRequest {
  readonly threadId: string;
  readonly kind: string;
  readonly status: string;
  readonly createdAt: string;
  readonly resolvedAt: string | null;
}

export interface ArcRecords {
  readonly runs: ReadonlyArray<ArcRun>;
  readonly turns: ReadonlyArray<ArcTurn>;
  readonly requests: ReadonlyArray<ArcRequest>;
}

const CELLS = `
  SELECT thread_id FROM orchestration_v2_projection_threads
  WHERE deleted_at IS NULL
    AND json_extract(payload_json, '$.lineage.parentThreadId') IS NULL
    AND coalesce(provider_instance_id, '') <> '${ASKI_INSTANCE_ID}'
`;

/**
 * Read on SQLite's reader, as upstream's long reads are: on the server's own
 * connection, a cold read from a busy disk held its event loop for seconds.
 */
export const readArcRecords = Effect.fn("StemcellsArcs.readRecords")(function* (since: string) {
  const sql = yield* SqlClient.SqlClient;
  const runs = yield* sql<ArcRun>`
    SELECT
      run.thread_id AS "threadId",
      run.requested_at AS "requestedAt",
      run.completed_at AS "completedAt",
      run.status AS status,
      (
        SELECT json_extract(message.payload_json, '$.text')
        FROM orchestration_v2_projection_messages AS message
        WHERE message.run_id = run.run_id AND message.role = 'assistant'
        ORDER BY message.created_at DESC, message.message_id DESC
        LIMIT 1
      ) AS reply
    FROM orchestration_v2_projection_runs AS run
    WHERE run.requested_at >= ${since} AND run.thread_id IN (${sql.unsafe(CELLS)})
  `.pipe(NodeSqliteClient.readOnly);
  const turns = yield* sql<ArcTurn>`
    SELECT thread_id AS "threadId", created_at AS at
    FROM orchestration_v2_projection_messages
    WHERE role = 'user'
      AND created_at >= ${since}
      AND json_extract(payload_json, '$.createdBy') = 'user'
      AND json_extract(payload_json, '$.creationSource') IS NOT 'server'
      AND json_extract(payload_json, '$.scheduledTaskId') IS NULL
      AND thread_id IN (${sql.unsafe(CELLS)})
  `.pipe(NodeSqliteClient.readOnly);
  const requests = yield* sql<ArcRequest>`
    SELECT
      thread_id AS "threadId",
      kind,
      status,
      created_at AS "createdAt",
      resolved_at AS "resolvedAt"
    FROM orchestration_v2_projection_runtime_requests
    WHERE created_at >= ${since} AND thread_id IN (${sql.unsafe(CELLS)})
  `.pipe(NodeSqliteClient.readOnly);
  return { runs, turns, requests } satisfies ArcRecords;
});
