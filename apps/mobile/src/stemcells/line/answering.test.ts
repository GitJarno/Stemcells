import { describe, expect, it } from "vite-plus/test";

import { type Act, createAnswering } from "./answering";
import type { ThreadCommand } from "./kit";

const act = (key: string, ...commands: ThreadCommand[]): Act => ({
  key,
  environmentId: "mac",
  threadId: `thread-${key}`,
  who: key,
  commands,
});

const yes: ThreadCommand = { type: "respond", requestId: "r1", decision: "accept" };
const reply: ThreadCommand = { type: "message", text: "Use the second." };

function setup(failOn?: ThreadCommand["type"]) {
  const sent: ThreadCommand[] = [];
  const answering = createAnswering({
    send: async (_environmentId, _threadId, command) => {
      sent.push(command);
      return command.type === failOn ? { ok: false, why: "refused" } : { ok: true };
    },
    now: () => 0,
  });
  return { answering, sent };
}

describe("an answer goes at once", () => {
  it("takes the ask off and sends its commands in order, off the list until it's no longer asked", async () => {
    const { answering, sent } = setup();
    const going = answering.send(act("a", yes, reply));
    expect(answering.read().answered).toEqual(new Set(["a"]));
    await going;
    expect(sent).toEqual([yes, reply]);
    answering.keepOnly(new Set(), 0);
    expect(answering.read().answered).toEqual(new Set());
  });

  it("brings the ask back when nothing went, and says so until it's answered again", async () => {
    const { answering } = setup("respond");
    await answering.send(act("Harbor", yes));
    expect(answering.read().answered).toEqual(new Set());
    expect(answering.read().failed.get("Harbor")?.words).toBe("Couldn't send to Harbor: refused");
    void answering.send(act("Harbor", reply));
    expect(answering.read().failed.size).toBe(0);
  });

  it("keeps a part-sent answer's ask off, saying what failed", async () => {
    const { answering, sent } = setup("message");
    await answering.send(act("Harbor", yes, reply));
    expect(sent).toEqual([yes, reply]);
    expect(answering.read().answered).toEqual(new Set(["Harbor"]));
    expect(answering.read().failed.has("Harbor")).toBe(true);
    answering.keepOnly(new Set(), 0);
    expect(answering.read().failed.size).toBe(0);
  });

  it("shows an ask again that is still asked long after its answer went", async () => {
    const { answering } = setup();
    await answering.send(act("a", yes));
    answering.keepOnly(new Set(["a"]), 60_000);
    expect(answering.read().answered).toEqual(new Set(["a"]));
    answering.keepOnly(new Set(["a"]), 3 * 60_000);
    expect(answering.read().answered).toEqual(new Set());
  });
});
