// @effect-diagnostics globalDate:off - Cells are placed on the reader's own calendar, as questions name it.
import * as NodeServices from "@effect/platform-node/NodeServices";
import { assert, it } from "@effect/vitest";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Path from "effect/Path";
import * as Queue from "effect/Queue";
import * as Stream from "effect/Stream";
import * as TestClock from "effect/testing/TestClock";

import { ASKI_INSTANCE_ID } from "../aski/instanceId.ts";
import { openLedgerFile } from "../upstream/ledger.ts";
import {
  instanceId,
  projectId as projectIdOf,
  runId,
  shellFixture,
  threadId,
} from "../upstream/needs.fixture.ts";
import type { Shell } from "../upstream/needs.ts";
import type { RecallProject, RecallSource } from "../upstream/recall.ts";
import type { RunRead } from "./card.ts";
import { make, type RecallQuery } from "./Recall.ts";
import { ranked } from "./search.ts";

/** Friday 27 November 2026 at noon, on the reader's own clock. */
const NOW = new Date(2026, 10, 27, 12).getTime();
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const time = (ms: number) => DateTime.makeUnsafe(ms);

const PROJECTS: ReadonlyArray<RecallProject> = [
  { id: "project-harbor", title: "Harbor", repo: "example.com/acme/harbor" },
  // A second checkout of Harbor's repository.
  { id: "project-harbor-site", title: "Harbor Site", repo: "example.com/acme/harbor" },
  { id: "project-atlas", title: "Atlas", repo: "example.com/acme/atlas" },
];

/** A Cell told `asked` at noon `daysAgo` days back, which landed an hour later. */
const cell = (
  id: string,
  projectId: string,
  title: string,
  asked: string,
  daysAgo: number,
  overrides: Partial<Shell> = {},
): { readonly shell: Shell; readonly run: RunRead } => {
  const born = NOW - daysAgo * DAY;
  return {
    shell: shellFixture({
      id,
      projectId: projectIdOf(projectId),
      title,
      createdAt: time(born),
      latestRunId: runId(`${id}-run-1`),
      latestRunCompletedAt: time(born + HOUR),
      latestUserMessageAt: time(born),
      updatedAt: time(born + HOUR),
      ...overrides,
    }),
    run: {
      messages: [{ text: asked, at: born, news: false, fromCell: false }],
      reply: `**Done:** ${title.toLowerCase()} is in`,
      records: { told: [], ran: [], files: [] },
    },
  };
};

/** A source over Cells the test edits, with the changes it tells of, on a file of its own. */
const fakeSource = Effect.fn("fakeSource")(function* (file: string) {
  const cells = new Map<string, { readonly shell: Shell; readonly run: RunRead }>();
  /** The chats whose run was read, in order: a card's costly read. */
  const runReads: string[] = [];
  /** Each start of the tap. */
  const starts = yield* Queue.unbounded<void>();
  /** A null ends the tap, as a failed read would. */
  const feed = yield* Queue.unbounded<ReadonlyArray<string> | null>();
  const source: RecallSource = {
    ready: Effect.void,
    environmentId: "environment-mac",
    open: openLedgerFile(file),
    latestSequence: Effect.succeed(10),
    changes: () =>
      Stream.unwrap(
        Effect.as(
          Queue.offer(starts, undefined),
          Stream.fromQueue(feed).pipe(
            Stream.takeWhile((change): change is ReadonlyArray<string> => change !== null),
          ),
        ),
      ),
    threadIdsAfter: (after, limit) =>
      Effect.sync(() =>
        [...cells.keys()]
          .filter((id) => id > after)
          .toSorted()
          .slice(0, limit),
      ),
    shell: (id) => Effect.sync(() => cells.get(id)?.shell ?? null),
    run: (id) =>
      Effect.sync(() => {
        runReads.push(id);
        return cells.get(id)!.run;
      }),
    projects: Effect.succeed(PROJECTS),
  };
  return {
    source,
    runReads,
    put: (each: { readonly shell: Shell; readonly run: RunRead }) => cells.set(each.shell.id, each),
    drop: (id: string) => cells.delete(id),
    started: until(Queue.take(starts)),
    /** Tells of a change to these chats, and waits until their cards are brought up to it. */
    told: (...threadIds: string[]) =>
      Queue.offerAll(feed, [threadIds, null]).pipe(Effect.andThen(until(Queue.take(starts)))),
  };
});

/** `milestone`, with the clock moving a second at a time meanwhile for recall's own waits. */
function until<A, E>(milestone: Effect.Effect<A, E>): Effect.Effect<A, E> {
  return Effect.raceFirst(
    milestone,
    TestClock.adjust("1 second").pipe(
      Effect.repeat({ times: 900 }),
      Effect.andThen(Effect.die("milestone never reached")),
    ),
  );
}

const recallFile = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  return path.join(yield* fs.makeTempDirectoryScoped({ prefix: "stemcells-recall-" }), "r.sqlite");
});

const asked = (query: string, more: Partial<RecallQuery> = {}): RecallQuery => ({
  query,
  from: null,
  to: null,
  project: null,
  state: "both",
  limit: 6,
  scope: "all",
  ...more,
});

/** The Cells every test starts from. */
const seeded = Effect.gen(function* () {
  yield* TestClock.setTime(NOW);
  const fake = yield* fakeSource(yield* recallFile);
  fake.put(
    cell("film", "project-harbor", "Film detail page", "Build the film detail page", 2, {
      settledAt: time(NOW - DAY),
    }),
  );
  // The same words, three weeks back.
  fake.put(
    cell("film-first", "project-harbor", "Film detail page", "Build the film detail page", 20),
  );
  fake.put(cell("site", "project-harbor-site", "Landing copy", "Tighten the landing copy", 1));
  fake.put(cell("tokens", "project-atlas", "Header tokens", "Rename the header tokens", 1));
  // Says film and page only in what was asked: a weaker match than a title's.
  fake.put(cell("notes", "project-atlas", "Release notes", "Mention the film festival page", 0));
  // No Cell's: Aski's own chat, a Subcell's, a side chat, and a chat that never ran.
  fake.put(
    cell("aski", "project-atlas", "Film page talk", "the film page", 0, {
      providerInstanceId: instanceId(ASKI_INSTANCE_ID),
    }),
  );
  fake.put(
    cell("sub", "project-harbor", "Film page tests", "test the film page", 0, {
      lineage: {
        rootThreadId: threadId("film"),
        parentThreadId: threadId("film"),
        relationshipToParent: "subagent",
      },
    }),
  );
  fake.put(
    cell("side", "project-harbor", "Film page aside", "about the film page", 0, {
      lineage: {
        rootThreadId: threadId("film"),
        parentThreadId: threadId("film"),
        relationshipToParent: "fork",
        sideChat: true,
      },
    }),
  );
  fake.put(
    cell("draft", "project-harbor", "Film page draft", "film page", 0, { latestRunId: null }),
  );
  const recall = yield* make(fake.source);
  yield* until(recall.checked);
  const found = (query: RecallQuery) =>
    Effect.map(recall.search(query), (answer) => ({
      ...answer,
      ids: answer.cards.map((card) => card.threadId),
    }));
  return { fake, recall, found };
});

it.layer(NodeServices.layer)("recall", (it) => {
  it.effect("finds a Cell by the time, the project and the words a question names", () =>
    Effect.gen(function* () {
      const { found } = yield* seeded;

      // The time is a filter: the same words three weeks back don't answer "two days ago".
      const film = yield* found(
        asked("where was that chat about the film detail page two days ago, what came of it?"),
      );
      assert.deepStrictEqual(film.ids, ["film"]);
      assert.deepStrictEqual(film.read.words, ["film", "detail", "page"]);
      assert.strictEqual(film.more, 0);
      assert.deepStrictEqual(
        {
          asked: film.cards[0]!.asked,
          line: film.cards[0]!.line,
          awake: film.cards[0]!.awake,
          link: film.cards[0]!.link,
        },
        {
          asked: ["Build the film detail page"],
          line: "film detail page is in",
          awake: false,
          link: "[Film detail page](t3-thread://v2/environment-mac/film)",
        },
      );

      // A project heard by ear, and a week: no free word is left, so the newest come first.
      const week = yield* found(asked("what did we do in harbour this week"));
      assert.deepStrictEqual(week.ids, ["film"]);
      assert.deepStrictEqual(week.read.project, { id: "project-harbor", title: "Harbor" });
      assert.deepStrictEqual(week.read.words, []);

      // Words alone: a title's match before one in what was asked, the newer of two equal first.
      const words = yield* found(asked("the film page"));
      assert.deepStrictEqual(words.ids, ["film", "film-first", "notes"]);

      assert.deepStrictEqual((yield* found(asked("film page", { state: "asleep" }))).ids, ["film"]);
      assert.deepStrictEqual((yield* found(asked("film page", { state: "awake" }))).ids, [
        "film-first",
        "notes",
      ]);

      // A window a client read by its own clock stands in place of the words' own.
      const window = yield* found(
        asked("film page yesterday", { from: NOW - 21 * DAY, to: NOW - 19 * DAY }),
      );
      assert.deepStrictEqual(window.ids, ["film-first"]);

      // Past the limit, the rest are counted.
      const one = yield* found(asked("film page", { limit: 1 }));
      assert.deepStrictEqual([one.ids, one.more], [["film"], 2]);

      // A misremembered day: the words are found at another time, and the answer says so.
      const misremembered = yield* found(asked("the header tokens rename last month"));
      assert.deepStrictEqual([misremembered.ids, misremembered.read.widened], [["tokens"], true]);

      // Nothing to search by, and nothing that matches.
      assert.deepStrictEqual((yield* found(asked("hey there"))).ids, []);
      assert.deepStrictEqual((yield* found(asked("where was the checkout rewrite"))).ids, []);
    }),
  );

  it.effect("answers a Cell for its own repository's Cells alone", () =>
    Effect.gen(function* () {
      const { found } = yield* seeded;
      // From a second checkout of Harbor's repository: Harbor's Cells, never Atlas's.
      const site = { projectId: "project-harbor-site" };
      assert.deepStrictEqual((yield* found(asked("film page", { scope: site }))).ids, [
        "film",
        "film-first",
      ]);
      assert.deepStrictEqual(
        (yield* found(asked("what happened yesterday", { scope: site }))).ids,
        ["site"],
      );
      // Another repository's project isn't heard: naming it finds nothing of it.
      const atlas = yield* found(asked("what did we do in Atlas this week", { scope: site }));
      assert.deepStrictEqual([atlas.ids, atlas.read.project], [[], null]);
      assert.deepStrictEqual(
        (yield* found(asked("anything", { scope: site, project: "Atlas", from: 0, to: NOW }))).ids,
        ["site", "film", "film-first"],
      );
      // A project with no repository is alone in its scope.
      assert.deepStrictEqual(
        (yield* found(asked("film page", { scope: { projectId: "project-elsewhere" } }))).ids,
        [],
      );
    }),
  );

  it.effect("keeps a card up with its Cell, and lets it go with it", () =>
    Effect.gen(function* () {
      const { fake, found } = yield* seeded;
      yield* fake.started;
      const before = fake.runReads.length;

      // A Cell lands for the first time: its card is there to find.
      fake.put(cell("export", "project-atlas", "CSV export", "Add a CSV export to reports", 0));
      yield* fake.told("export");
      assert.deepStrictEqual((yield* found(asked("the csv export"))).ids, ["export"]);
      assert.deepStrictEqual(fake.runReads.slice(before), ["export"]);

      // Renamed and put to sleep: found by its new title, with no run read again.
      const renamed = cell(
        "export",
        "project-atlas",
        "Spreadsheet download",
        "Add a CSV export to reports",
        0,
        {
          settledAt: time(NOW),
        },
      );
      fake.put(renamed);
      yield* fake.told("export");
      const asleep = yield* found(asked("spreadsheet download", { state: "asleep" }));
      assert.deepStrictEqual(asleep.ids, ["export"]);
      assert.deepStrictEqual(fake.runReads.slice(before), ["export"]);

      // Deleted, or gone from upstream: its card goes.
      fake.put({ ...renamed, shell: { ...renamed.shell, deletedAt: time(NOW) } });
      fake.drop("tokens");
      yield* fake.told("export", "tokens");
      assert.deepStrictEqual((yield* found(asked("spreadsheet csv export"))).ids, []);
      assert.deepStrictEqual((yield* found(asked("header tokens"))).ids, []);
    }),
  );
});

it("puts the nearest match first, and the newest first among the equally near", () => {
  const hit = (threadId: string, score: number, touchedAt: number) => ({
    card: { threadId } as never,
    score,
    touchedAt,
  });
  assert.deepStrictEqual(
    ranked([hit("older", -4.02, 1), hit("far", -1.5, 9), hit("newer", -3.98, 5)]).map(
      (each) => (each.card as { threadId: string }).threadId,
    ),
    ["newer", "older", "far"],
  );
});
