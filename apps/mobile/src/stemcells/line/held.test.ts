import { describe, expect, it } from "vite-plus/test";

import { type Act, createHeld } from "./held";
import type { ThreadCommand } from "./kit";

const act = (key: string, ...commands: ThreadCommand[]): Act => ({
  key,
  environmentId: "mac",
  threadId: `thread-${key}`,
  words: `Answered ${key}`,
  who: key,
  commands,
});

const yes: ThreadCommand = { type: "respond", requestId: "r1", decision: "accept" };
const reply: ThreadCommand = { type: "message", text: "Use the second." };

/** A hold whose line goes when the test says, over a machine that asks what `asked` holds. */
function setup(options: { asked?: boolean | null; failOn?: ThreadCommand["type"] } = {}) {
  const sent: Array<{ threadId: string; command: ThreadCommand }> = [];
  let lineGoes: (() => unknown) | null = null;
  const held = createHeld({
    send: async (_environmentId, threadId, command) => {
      sent.push({ threadId, command });
      return command.type === options.failOn ? { ok: false, why: "refused" } : { ok: true };
    },
    stillAsks: async () => (options.asked === undefined ? true : options.asked),
    after: (_ms, then) => {
      lineGoes = then;
      return () => {
        if (lineGoes === then) lineGoes = null;
      };
    },
    now: () => 0,
  });
  /** The line's time runs out; resolves once what it sent is in. */
  const lineRunsOut = async () => {
    await lineGoes?.();
  };
  return { held, sent, lineRunsOut };
}

describe("your own act never waits", () => {
  it("takes the ask off at once and holds the answer on the undo line", () => {
    const { held, sent } = setup();
    void held.hold(act("a", yes));
    expect(held.read().answered).toEqual(new Set(["a"]));
    expect(held.read().line).toEqual({ kind: "held", act: act("a", yes) });
    expect(sent).toEqual([]);
  });

  it("brings the ask back on Undo and sends nothing", async () => {
    const { held, sent, lineRunsOut } = setup();
    void held.hold(act("a", yes));
    held.undo();
    await lineRunsOut();
    expect(held.read()).toEqual({ line: null, answered: new Set() });
    expect(sent).toEqual([]);
  });

  it("sends the answer's commands in order when the line goes", async () => {
    const { held, sent, lineRunsOut } = setup();
    void held.hold(act("a", yes, reply));
    await lineRunsOut();
    expect(sent.map((each) => each.command)).toEqual([yes, reply]);
    expect(held.read().line).toBeNull();
    // Off the list until its machine stops asking it.
    expect(held.read().answered).toEqual(new Set(["a"]));
    held.keepOnly(new Set(), 0);
    expect(held.read().answered).toEqual(new Set());
  });

  it("lets the answer before go when you answer the next", async () => {
    const { held, sent } = setup();
    void held.hold(act("a", yes));
    await held.hold(act("b", reply));
    expect(sent).toEqual([{ threadId: "thread-a", command: yes }]);
    expect(held.read().line).toEqual({ kind: "held", act: act("b", reply) });
  });

  it("sends nothing to a Cell that already had an answer, and says so", async () => {
    const { held, sent, lineRunsOut } = setup({ asked: false });
    void held.hold(act("Harbor", yes));
    await lineRunsOut();
    expect(sent).toEqual([]);
    expect(held.read().line).toEqual({
      kind: "said",
      words: "Harbor already had an answer. Yours wasn't sent.",
    });
  });

  it("brings the ask back when nothing could go", async () => {
    const out = setup({ asked: null });
    void out.held.hold(act("Harbor", yes));
    await out.lineRunsOut();
    expect(out.sent).toEqual([]);
    expect(out.held.read().answered).toEqual(new Set());

    const refused = setup({ failOn: "respond" });
    void refused.held.hold(act("Harbor", yes));
    await refused.lineRunsOut();
    expect(refused.held.read().answered).toEqual(new Set());
    expect(refused.held.read().line).toEqual({
      kind: "said",
      words: "Couldn't send to Harbor: refused",
    });
  });

  it("brings an ask set aside to settle back, saying why when its Cell wouldn't stop", () => {
    const { held } = setup();
    held.aside("a");
    expect(held.read().answered).toEqual(new Set(["a"]));
    held.back("a", "Couldn't stop it to settle it.");
    expect(held.read()).toEqual({
      answered: new Set(),
      line: { kind: "said", words: "Couldn't stop it to settle it." },
    });
  });

  it("takes an act already done back on Undo, and lets it go untouched for the next act", async () => {
    let takenBack = 0;
    const done = { key: "disk:mac", words: "Disk notice hidden", takeBack: () => takenBack++ };
    const { held, sent } = setup();
    void held.did(done);
    expect(held.read().line).toEqual({ kind: "done", ...done });
    held.undo();
    expect(takenBack).toBe(1);
    expect(held.read().line).toBeNull();

    void held.did(done);
    await held.hold(act("a", yes));
    expect(takenBack).toBe(1);
    expect(held.read().line).toEqual({ kind: "held", act: act("a", yes) });

    // What became of the answer before doesn't take the done act's place.
    const late = setup({ asked: false });
    void late.held.hold(act("Harbor", yes));
    await late.held.did(done);
    expect(late.held.read().line).toEqual({ kind: "done", ...done });
    expect([...sent, ...late.sent]).toEqual([]);
  });

  it("shows an ask again that is still asked long after its answer went", () => {
    const { held } = setup();
    void held.hold(act("a", yes));
    void held.letGo();
    held.keepOnly(new Set(["a"]), 60_000);
    expect(held.read().answered).toEqual(new Set(["a"]));
    held.keepOnly(new Set(["a"]), 3 * 60_000);
    expect(held.read().answered).toEqual(new Set());
  });
});
