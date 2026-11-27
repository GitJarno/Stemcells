import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

import type { CommandOutcome, ThreadCommand } from "../upstream/needs";
import type { Spoken } from "./answers/giveBack";
import { needFixture } from "./fixtures";
import { createAnswering } from "./answering";
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
  const went: string[] = [];
  const answering = createAnswering({
    send: async (_threadId, command) => {
      sent.push(command);
      return outcomes.shift() ?? { ok: true };
    },
    needs: () => state,
    sent: (key) => void went.push(key),
  });
  const send = (commands: ThreadCommand[] = [decline], words?: Spoken) =>
    answering.send({
      key: needFixture().key,
      threadId: "thread-floof",
      commands,
      ...(words === undefined ? {} : { words }),
    });
  return {
    answering,
    send,
    sent,
    went,
    setNeeds: (next: NeedsState) => void (state = next),
    stateOf: () => answering.read().get(needFixture().key)?.state,
  };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("an answer goes at once", () => {
  it("sends every command in order, then reads as sent", async () => {
    const t = setup();
    const going = t.send([decline, note]);
    expect(t.stateOf()).toBe("sending");
    await going;
    expect(t.sent).toEqual([decline, note]);
    expect(t.stateOf()).toBe("sent");
  });

  it("sends nothing when the need left: answered elsewhere, or asked again", async () => {
    const t = setup();
    t.setNeeds({
      needs: [needFixture({ key: "thread-floof:request:request-2" })],
      cells: null,
      live: true,
    });
    await t.send();
    expect(t.sent).toEqual([]);
    expect(t.stateOf()).toBe("stale");
  });

  it("sends nothing on a list it can't trust, and says so", async () => {
    const t = setup();
    t.setNeeds({ needs: [needFixture()], cells: null, live: false });
    await t.send();
    expect(t.sent).toEqual([]);
    expect(t.stateOf()).toBe("failed");
  });

  it("tells the asks' ledger only of an answer that went whole", async () => {
    const refused = setup([{ ok: true }, { ok: false, why: "the Cell stopped" }]);
    await refused.send([decline, note]);
    expect(refused.went).toEqual([]);

    const went = setup();
    await went.send([decline, note]);
    expect(went.went).toEqual([needFixture().key]);
  });

  it("stops at the first command that fails, so a note never follows a refused decline", async () => {
    const t = setup([{ ok: false, why: "already answered" }]);
    await t.send([decline, note]);
    expect(t.sent).toEqual([decline]);
    expect(t.answering.read().get(needFixture().key)?.why).toBe("Couldn't send: already answered");
  });
});

describe("an answer read from words in Aski's composer", () => {
  const key = needFixture().key;

  it("gives its words back once when the need moved before it went", async () => {
    const t = setup();
    t.setNeeds({ needs: [], cells: null, live: true });
    await t.send([decline], NO);
    expect(t.stateOf()).toBe("stale");
    expect(t.answering.takeWords(key)).toBe(NO);
    expect(t.answering.takeWords(key)).toBeNull();
    expect(t.answering.read().get(key)?.wordsBack).toBe(true);
  });

  it("gives them back when nothing could be sent", async () => {
    const t = setup([{ ok: false, why: "already answered" }]);
    await t.send([decline, note], NO_STAGING);
    expect(t.answering.takeWords(key)).toBe(NO_STAGING);
  });

  it("keeps none once a command went: they would answer twice", async () => {
    const t = setup([{ ok: true }, { ok: false, why: "the chat is gone" }]);
    await t.send([decline, note], NO_STAGING);
    expect(t.stateOf()).toBe("failed");
    expect(t.answering.takeWords(key)).toBeNull();
  });

  it("keeps none once sent, and none while it goes", async () => {
    const t = setup();
    const going = t.send([decline], NO);
    expect(t.answering.takeWords(key)).toBeNull();
    await going;
    expect(t.stateOf()).toBe("sent");
    expect(t.answering.takeWords(key)).toBeNull();
  });

  it("stays while the words wait, so they never go unsaid, and lets it go once back", async () => {
    const t = setup();
    t.setNeeds({ needs: [], cells: null, live: true });
    await t.send([decline], NO);
    await vi.advanceTimersByTimeAsync(10 * 60_000);
    expect(t.stateOf()).toBe("stale");
    expect(t.answering.takeWords(key)).toBe(NO);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(t.stateOf()).toBeUndefined();
  });
});
