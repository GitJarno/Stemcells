/**
 * What the work verbs rely on in upstream's chat timeline: which entries
 * start a turn, where its working row and its fold stand, and the words they
 * say. If one fails after a sync, `turnStartsOf` or `workedLabel` follows
 * upstream's new shape.
 */
import { MessageId, RunId } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import { deriveMessagesTimelineRows } from "../../components/chat/MessagesTimeline.logic";
import { turnVerbsOf } from "../verbs/turnVerbs";
import { chain, workedLabel } from "../verbs/workVerbs";
import { turnStartsOf, type TimelineEntries } from "./workVerbs";

const time = (second: number) => new Date(Date.UTC(2026, 0, 1, 0, 0, second)).toISOString();

const said = (
  id: string,
  role: "user" | "assistant",
  run: string,
  second: number,
  inputIntent?: "steer" | "promoted_queued_to_steer",
) => ({
  kind: "message" as const,
  id,
  createdAt: time(second),
  message: {
    id: MessageId.make(id),
    role,
    text: id,
    runId: RunId.make(run),
    ...(inputIntent ? { inputIntent } : {}),
    createdAt: time(second),
    updatedAt: time(second),
    streaming: false,
  },
});

const work = (id: string, run: string, second: number, notification = false) => ({
  kind: "work" as const,
  id,
  createdAt: time(second),
  entry: {
    id,
    runId: RunId.make(run),
    createdAt: time(second),
    label: id,
    tone: "tool" as const,
    ...(notification ? { itemType: "notification" as const } : {}),
  },
});

const rowsOf = (
  timelineEntries: TimelineEntries,
  run: string,
  status: "running" | "completed" | "failed" | "interrupted",
  span: readonly [number, number],
) =>
  deriveMessagesTimelineRows({
    timelineEntries,
    latestRun: {
      runId: RunId.make(run),
      status,
      startedAt: time(span[0]),
      completedAt: status === "running" ? null : time(span[1]),
    },
    isWorking: status === "running",
    activeTurnStartedAt: time(span[0]),
    turnDiffSummaries: [],
    supportsConversationRollback: false,
  });

const folds = (rows: ReturnType<typeof deriveMessagesTimelineRows>) =>
  rows.flatMap((row) => (row.kind === "turn-fold" ? [row] : []));

const twoTurns = [
  said("fix the crash", "user", "run-1", 0),
  work("read-1", "run-1", 8),
  said("answer-1", "assistant", "run-1", 20),
  said("polish the header", "user", "run-2", 30),
  work("read-2", "run-2", 31),
  said("answer-2", "assistant", "run-2", 40),
];

describe("upstream's timeline, as the work verbs read it", () => {
  it("folds a finished turn under Worked for its time, from when its prompt was sent", () => {
    const rows = rowsOf(twoTurns, "run-2", "completed", [30, 40]);
    expect(folds(rows).map((fold) => [fold.label, fold.createdAt])).toEqual([
      ["Worked for 20s", time(0)],
      ["Worked for 10s", time(30)],
    ]);
    const verbs = turnVerbsOf(twoTurns);
    const chained = chain(turnStartsOf(twoTurns));
    expect(folds(rows).map((fold) => verbs.at(fold.createdAt))).toEqual([
      chained.get("fix the crash"),
      chained.get("polish the header"),
    ]);
    const [first] = folds(rows);
    const verb = chained.get("fix the crash")!;
    expect(workedLabel(verb, first!.label)).toBe(`${verb.past} ${verb.span} 20s`);
  });

  it("draws the working row for the last turn", () => {
    const running = twoTurns.slice(0, 5);
    const rows = rowsOf(running, "run-2", "running", [30, 30]);
    const ids = rows.map((row) => row.id);
    expect(ids.indexOf("working-indicator-row")).toBeGreaterThan(ids.indexOf("polish the header"));
    expect(turnVerbsOf(running).live).toBe(chain(turnStartsOf(running)).get("polish the header"));
  });

  it.each(["steer", "promoted_queued_to_steer"] as const)(
    "lets a %s join the running turn rather than start one",
    (intent) => {
      const entries = [
        said("first", "user", "run-1", 0),
        said("steered", "user", "run-1", 5, intent),
        work("read", "run-1", 8),
        said("answer", "assistant", "run-1", 20),
      ];
      expect(turnStartsOf(entries).map((start) => start.id)).toEqual(["first"]);
      const [fold] = folds(rowsOf(entries, "run-1", "completed", [0, 20]));
      expect(fold?.createdAt).toBe(time(0));
    },
  );

  it("starts a turn at a notification, with no words of the person's", () => {
    const entries = [
      said("first", "user", "run-1", 0),
      work("read-1", "run-1", 1),
      said("answer-1", "assistant", "run-1", 5),
      work("wake", "run-2", 20, true),
      work("read-2", "run-2", 21),
      said("answer-2", "assistant", "run-2", 25),
    ];
    expect(turnStartsOf(entries)).toEqual([
      { id: "first", text: "first", createdAt: time(0) },
      { id: "wake", text: "", createdAt: time(20) },
    ]);
    const fold = folds(rowsOf(entries, "run-2", "completed", [20, 25])).at(-1);
    expect(fold?.createdAt).toBe(time(20));
  });

  // A failed turn has no fold to wear a verb: it reads plain.
  it("leaves a failed turn unfolded", () => {
    expect(folds(rowsOf(twoTurns, "run-2", "failed", [30, 40])).map((fold) => fold.runId)).toEqual([
      RunId.make("run-1"),
    ]);
  });

  it("says a stopped turn plainly, in words the verbs leave alone", () => {
    const entries = [said("first", "user", "run-1", 0), work("read", "run-1", 5)];
    const [fold] = folds(rowsOf(entries, "run-1", "interrupted", [0, 47]));
    expect(fold?.label).toBe("You stopped after 47s");
    const verb = turnVerbsOf(entries).at(fold!.createdAt);
    expect(verb).not.toBeNull();
    expect(workedLabel(verb, fold!.label)).toBe(fold!.label);
  });
});
