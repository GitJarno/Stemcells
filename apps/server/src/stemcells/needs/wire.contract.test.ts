/**
 * The wire between this server's needs list and its readers: the web keeps its own copy of the
 * types, and the phone reads the JSON with its check (`apps/web/src/stemcells/needs/wire.ts`).
 * A field renamed here, or one a reader needs and the server stopped sending, fails here rather
 * than as a phone with no line.
 */
import { assert, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Stream from "effect/Stream";
import * as TestClock from "effect/testing/TestClock";
import { expectTypeOf } from "vite-plus/test";

import * as Wire from "../../../../web/src/stemcells/needs/wire.ts";
import type { NeedsSource, RequestDetail, Shell } from "../upstream/needs.ts";
import { MINUTE, NOW, pendingRequest, runId, shellFixture } from "../upstream/needs.fixture.ts";
import { make, type NeedsList } from "./Needs.ts";

it("the server's list has the wire's types", () => {
  // Checked by the type check; the JSON below is checked as it runs.
  expectTypeOf<NeedsList>().toExtend<Wire.NeedsList>();
});

const detail = (id: string): RequestDetail => ({
  id,
  prompt: "pnpm test",
  appName: null,
  reason: "Runs the tests",
  fullAccessOverride: null,
  options: [{ decision: "accept", label: "Approve" }],
  questions: [],
  responseMode: null,
  capability: "live",
});

/** A machine with one Cell asking, one at work and one done. */
const shells: ReadonlyArray<Shell> = [
  shellFixture({ id: "asking", pendingRuntimeRequest: pendingRequest("command", { id: "r1" }) }),
  shellFixture({ id: "busy", status: "running", activeRunId: runId("run-2") }),
  shellFixture({ id: "finished" }),
];

const source: NeedsSource = {
  ready: Effect.void,
  snapshot: Effect.succeed({ shells, sequence: 0 }),
  // The person settles the finished one by hand, from the phone.
  changedThreads: () =>
    Stream.make([{ threadId: shells[2]!.id, lively: false, settledByHandAt: NOW + MINUTE }]),
  shell: (id) => Effect.succeed(shells.find((shell) => shell.id === id) ?? null),
  request: (_threadId, requestId) => Effect.succeed(detail(requestId)),
  plan: () => Effect.succeed(null),
  reply: () => Effect.succeed(null),
  inFlight: () => Effect.succeed({ tool: null }),
  autoResume: Effect.succeed(false),
};

it.effect("the JSON the server sends is what the phone reads", () =>
  Effect.scoped(
    Effect.gen(function* () {
      yield* TestClock.setTime(NOW + MINUTE);
      const needs = yield* make(source);
      const sent = yield* needs.changes.pipe(
        Stream.filter((list) => list.settles?.length === 1),
        Stream.runHead,
        Effect.map(Option.getOrThrow),
      );
      // As `http.ts` sends it, and as the phone reads it.
      const read = Wire.needsListOf(JSON.parse(JSON.stringify(sent)));
      assert.deepStrictEqual(
        read?.needs.map((need) => [need.threadId, need.kind, need.request?.prompt]),
        [["asking", "permission", "pnpm test"]],
      );
      // The phone's line stands on these; a list without them keeps its older tabs.
      assert.deepStrictEqual(read?.cells?.map((cell) => [cell.threadId, cell.stage]).toSorted(), [
        ["asking", "needs-you"],
        ["busy", "working"],
        ["finished", "done"],
      ]);
      // A Mac closes the settled Cell's panes on this.
      assert.deepStrictEqual(read?.settles, [
        { threadId: "finished", at: "2026-10-21T12:01:00.000Z" },
      ]);
    }),
  ),
);
