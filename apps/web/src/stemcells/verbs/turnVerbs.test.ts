import { describe, expect, it } from "vite-plus/test";

import type { TimelineEntries } from "../upstream/workVerbs";
import { turnVerbsOf } from "./turnVerbs";

const time = (second: number) => new Date(Date.UTC(2026, 0, 1, 0, 0, second)).toISOString();

const said = (id: string, role: "user" | "assistant", second: number, text = id) => ({
  kind: "message",
  id,
  createdAt: time(second),
  message: {
    id,
    role,
    text,
    runId: null,
    createdAt: time(second),
    updatedAt: time(second),
    streaming: false,
  },
});

const timeline = (...entries: ReturnType<typeof said>[]) => entries as unknown as TimelineEntries;

describe("a chat's work verbs", () => {
  it("stays the same object while its turns do, so streamed words redraw no row", () => {
    const asked = timeline(said("first", "user", 0), said("answer", "assistant", 1, "Partly"));
    const streamed = timeline(
      said("first", "user", 0),
      said("answer", "assistant", 1, "Partly, then all"),
    );
    expect(turnVerbsOf(streamed)).toBe(turnVerbsOf(asked));
    const next = timeline(...(asked as never[]), said("second", "user", 9));
    expect(turnVerbsOf(next)).not.toBe(turnVerbsOf(asked));
  });

  it("keeps a turn's word from its echo to the server's copy of it", () => {
    const echo = turnVerbsOf(timeline(said("first", "user", 0), said("second", "user", 9)));
    const settled = turnVerbsOf(timeline(said("first", "user", 0), said("second", "user", 11)));
    expect(settled.live).toBe(echo.live);
    expect(settled.at(time(11))).toBe(echo.at(time(9)));
  });

  it("gives each turn its own word, and nothing before the first", () => {
    const verbs = turnVerbsOf(
      timeline(said("first", "user", 0), said("answer", "assistant", 5), said("second", "user", 9)),
    );
    expect(verbs.at(time(0))).not.toBeNull();
    expect(verbs.at(time(5))).toBe(verbs.at(time(0)));
    expect(verbs.at(time(9))).toBe(verbs.live);
    expect(verbs.live).not.toBe(verbs.at(time(0)));
    expect(turnVerbsOf(timeline(said("later", "user", 9))).at(time(0))).toBeNull();
    expect(turnVerbsOf(timeline()).live).toBeNull();
  });
});
