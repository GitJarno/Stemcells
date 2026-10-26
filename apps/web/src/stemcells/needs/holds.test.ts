import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

import type { CommandOutcome, ThreadCommand } from "../upstream/needs";
import type { Spoken } from "./answers/giveBack";
import { needFixture } from "./fixtures";
import { createHolds } from "./holds";
import type { NeedsState } from "./stream";

const decline: ThreadCommand = { type: "respond", requestId: "request-1", decision: "decline" };
const note: ThreadCommand = { type: "message", text: "use staging" };

/** Words that said an answer, as Aski's composer keeps them. */
const spoken = (...words: string[]): Spoken => ({
  key: needFixture().key,
  number: 3,
  who: "Pip",
  chose: "option decline",
  lines: [[{ type: "text", text: words.join(" ") } as Spoken["lines"][number][number]]],
});
const NO = spoken("no");
const NO_STAGING = spoken("no, use staging");

function setup(outcomes: CommandOutcome[] = []) {
  let state: NeedsState = { needs: [needFixture()], cells: null, live: true };
  const sent: ThreadCommand[] = [];
  let kept = 0;
  const lines: Array<{ readonly undo: () => void; readonly send: () => void }> = [];
  const went: string[] = [];
  const holds = createHolds({
    send: async (_threadId, command) => {
      sent.push(command);
      return outcomes.shift() ?? { ok: true };
    },
    needs: () => state,
    keepLive: () => (kept++, () => void kept--),
    line: (_key, acts) => void lines.push(acts),
    sent: (key) => void went.push(key),
  });
  const hold = (commands: ThreadCommand[] = [decline], words?: Spoken) =>
    holds.hold({
      key: needFixture().key,
      threadId: "thread-floof",
      commands,
      ...(words === undefined ? {} : { words }),
    });
  /** The undo line lets the newest answer go, and what it sends has gone. */
  const letGo = async (line = lines.at(-1)) => {
    line?.send();
    await vi.advanceTimersByTimeAsync(0);
  };
  return {
    holds,
    hold,
    letGo,
    lines,
    sent,
    went,
    kept: () => kept,
    setNeeds: (next: NeedsState) => void (state = next),
    stateOf: () => holds.read().get(needFixture().key)?.state,
  };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("an answer waits on the undo line", () => {
  it("sends nothing until the line lets it go, then sends every command in order", async () => {
    const t = setup();
    t.hold([decline, note]);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(t.sent).toEqual([]);
    await t.letGo();
    expect(t.sent).toEqual([decline, note]);
    expect(t.stateOf()).toBe("sent");
  });

  it("sends nothing once the line takes it back", async () => {
    const t = setup();
    t.hold();
    t.lines[0]!.undo();
    await t.letGo();
    expect(t.sent).toEqual([]);
    expect(t.stateOf()).toBeUndefined();
  });

  it("lets an older answer to the same need neither send nor take back the newer", async () => {
    const t = setup();
    t.hold([decline]);
    t.hold([note]);
    const [older, newer] = t.lines;
    older!.undo();
    expect(t.stateOf()).toBe("holding");
    await t.letGo(older);
    expect(t.sent).toEqual([]);
    await t.letGo(newer);
    expect(t.sent).toEqual([note]);
  });

  it("sends nothing when the need left meanwhile: answered elsewhere, or asked again", async () => {
    const t = setup();
    t.hold();
    t.setNeeds({
      needs: [needFixture({ key: "thread-floof:request:request-2" })],
      cells: null,
      live: true,
    });
    await t.letGo();
    expect(t.sent).toEqual([]);
    expect(t.stateOf()).toBe("stale");
  });

  it("sends nothing on a list it can't trust, and says so", async () => {
    const t = setup();
    t.hold();
    t.setNeeds({ needs: [needFixture()], cells: null, live: false });
    await t.letGo();
    expect(t.sent).toEqual([]);
    expect(t.stateOf()).toBe("failed");
  });

  it("tells the asks' ledger only of an answer that went whole", async () => {
    const taken = setup();
    taken.hold();
    taken.lines[0]!.undo();
    await taken.letGo();
    const refused = setup([{ ok: true }, { ok: false, why: "the Cell stopped" }]);
    refused.hold([decline, note]);
    await refused.letGo();
    expect([...taken.went, ...refused.went]).toEqual([]);

    const went = setup();
    went.hold([decline, note]);
    await went.letGo();
    expect(went.went).toEqual([needFixture().key]);
  });

  it("stops at the first command that fails, so a note never follows a refused decline", async () => {
    const t = setup([{ ok: false, why: "already answered" }]);
    t.hold([decline, note]);
    await t.letGo();
    expect(t.sent).toEqual([decline]);
    expect(t.holds.read().get(needFixture().key)?.why).toBe("Couldn't send: already answered");
  });

  it("sends what is held at once when the window closes", async () => {
    const t = setup();
    t.hold();
    t.holds.flush();
    await vi.advanceTimersByTimeAsync(0);
    expect(t.sent).toEqual([decline]);
  });

  it("keeps the list live only while an answer waits on it", async () => {
    const t = setup();
    t.hold();
    expect(t.kept()).toBe(1);
    await t.letGo();
    expect(t.kept()).toBe(0);
  });
});

describe("an answer read from words in Aski's composer", () => {
  const key = needFixture().key;

  it("gives its words back once when the need moved before it went", async () => {
    const t = setup();
    t.hold([decline], NO);
    t.setNeeds({ needs: [], cells: null, live: true });
    await t.letGo();
    expect(t.stateOf()).toBe("stale");
    expect(t.holds.takeWords(key)).toBe(NO);
    expect(t.holds.takeWords(key)).toBeNull();
    expect(t.holds.read().get(key)?.wordsBack).toBe(true);
  });

  it("gives them back when nothing could be sent", async () => {
    const t = setup([{ ok: false, why: "already answered" }]);
    t.hold([decline, note], NO_STAGING);
    await t.letGo();
    expect(t.holds.takeWords(key)).toBe(NO_STAGING);
  });

  it("keeps none once a command went: they would answer twice", async () => {
    const t = setup([{ ok: true }, { ok: false, why: "the chat is gone" }]);
    t.hold([decline, note], NO_STAGING);
    await t.letGo();
    expect(t.stateOf()).toBe("failed");
    expect(t.holds.takeWords(key)).toBeNull();
  });

  it("keeps none once sent, and none while it waits", async () => {
    const t = setup();
    t.hold([decline], NO);
    expect(t.holds.takeWords(key)).toBeNull();
    await t.letGo();
    expect(t.stateOf()).toBe("sent");
    expect(t.holds.takeWords(key)).toBeNull();
  });

  it("keeps its hold while the words wait, so they never go unsaid, and lets it go once back", async () => {
    const t = setup();
    t.hold([decline], NO);
    t.setNeeds({ needs: [], cells: null, live: true });
    await t.letGo();
    await vi.advanceTimersByTimeAsync(10 * 60_000);
    expect(t.stateOf()).toBe("stale");
    expect(t.holds.takeWords(key)).toBe(NO);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(t.stateOf()).toBeUndefined();
  });
});
