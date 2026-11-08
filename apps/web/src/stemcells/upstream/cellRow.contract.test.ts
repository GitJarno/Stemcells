import { describe, expect, it } from "vite-plus/test";

import { type CellShell, cellAgeAt, compactAge } from "./cellRow";

// The column's rows shorten upstream's relative time as its sidebar does.
describe("compactAge", () => {
  const now = Date.parse("2026-10-26T12:00:00.000Z");

  it('drops upstream\'s "ago", and says now for just now', () => {
    expect(compactAge("2026-10-26T11:55:00.000Z", now)).toBe("5m");
    expect(compactAge("2026-10-26T09:00:00.000Z", now)).toBe("3h");
    expect(compactAge("2026-10-26T12:00:00.000Z", now)).toBe("now");
  });
});

// A Cell's age counts from what upstream's sidebar dates a thread by.
describe("cellAgeAt", () => {
  const shell = {
    latestUserMessageAt: "2026-10-26T10:00:00.000Z",
    latestRun: {
      requestedAt: "2026-10-26T10:00:00.000Z",
      startedAt: "2026-10-26T10:00:01.000Z",
      completedAt: "2026-10-26T11:30:00.000Z",
    },
    updatedAt: "2026-10-26T11:40:00.000Z",
    settledAt: "2026-10-26T11:50:00.000Z",
  } as CellShell;

  it("counts from the latest reply, not the message that asked for it", () => {
    expect(cellAgeAt(shell, false)).toBe("2026-10-26T11:30:00.000Z");
  });

  it("counts a settled Cell from its settle", () => {
    expect(cellAgeAt(shell, true)).toBe("2026-10-26T11:50:00.000Z");
  });
});
