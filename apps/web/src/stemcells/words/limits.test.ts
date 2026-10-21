import { describe, expect, it } from "vite-plus/test";

import type { LimitPool } from "../upstream/rail";
import { limitNotes } from "./limits";

type PoolWindow = LimitPool["windows"][number];

const window = (
  label: string,
  remainingPercent: number,
  pace: PoolWindow["pace"] = "on",
  resets: ReadonlyArray<number> = [],
): PoolWindow =>
  ({
    id: label,
    kind: "weekly",
    label,
    members: [],
    columns: [],
    remainingPercent,
    usedPercent: 100 - remainingPercent,
    pace,
    resets: resets.map((at) => ({ at, member: {} as never, restoresPercent: 100 })),
  }) as PoolWindow;

const pool = (driver: string, ...windows: PoolWindow[]): LimitPool =>
  ({ driver, accounts: [], windows }) as unknown as LimitPool;

const HOUR = 3_600_000;

describe("the readout's plan notes", () => {
  it("names a provider the Cells start on whose plan runs short", () => {
    const notes = limitNotes(
      ["claudeAgent", "codex"],
      [pool("claudeAgent", window("Weekly", 6)), pool("codex", window("5 hours", 70))],
      0,
    );
    expect(notes).toHaveLength(1);
    expect(notes[0]).toMatchObject({ tone: "low" });
    expect(notes[0]!.text).toMatch(/ Weekly: 6% left$/);
  });

  it("says when a plan that ran out comes back", () => {
    const [note] = limitNotes(
      ["codex"],
      [pool("codex", window("5 hours", 0, "on", [2 * HOUR]))],
      0,
    );
    expect(note).toMatchObject({ tone: "out" });
    expect(note!.text).toMatch(/ 5 hours: 0% left · resets in /);
  });

  it("stays quiet for spending ahead of pace alone, and for providers no Cell uses", () => {
    expect(limitNotes(["codex"], [pool("codex", window("5 hours", 60, "ahead"))], 0)).toEqual([]);
    expect(limitNotes(["codex"], [pool("claudeAgent", window("Weekly", 2))], 0)).toEqual([]);
  });

  it("notes each provider once, however many Cells start on it", () => {
    expect(
      limitNotes(["claudeAgent", "claudeAgent"], [pool("claudeAgent", window("Weekly", 4))], 0),
    ).toHaveLength(1);
  });
});
