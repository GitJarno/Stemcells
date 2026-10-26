// What a server knows of its linked environments, read where upstream builds a provider's
// text (who's here, the frame), which hands us nothing that reaches the links service. A
// process runs one server (upstream's ownership lock: one per T3 home), so the service
// files its view here while it runs.

import * as Effect from "effect/Effect";

import type { ElsewhereThread } from "./roster.ts";

export interface Elsewhere {
  /** The Cells at work in `repo` on linked environments, as each last said. */
  readonly cellsIn: (repo: string) => ReadonlyArray<ElsewhereThread>;
  /**
   * Who sent a message that came from a linked environment: that
   * environment's name here (null once it's unlinked) and the sender's title
   * when this server still holds it.
   */
  readonly senderOf: (messageId: string) => {
    readonly environment: string | null;
    readonly title: string | null;
  };
}

let filed: Elsewhere | null = null;

/** Files `elsewhere` as this server's view until the scope closes. */
export const fileElsewhere = (elsewhere: Elsewhere) =>
  Effect.acquireRelease(
    Effect.sync(() => {
      filed = elsewhere;
    }),
    () =>
      Effect.sync(() => {
        if (filed === elsewhere) filed = null;
      }),
  );

/** This server's view of its linked environments; null while it files none. */
export const elsewhereNow = (): Elsewhere | null => filed;
