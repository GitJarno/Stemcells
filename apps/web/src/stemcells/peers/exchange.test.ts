import { describe, expect, it } from "vite-plus/test";

import { type Entry, exchangeOf, gistOf, senderOf, sentOf } from "./exchange";

const incoming = (id: string, from: string, text: string): Entry => ({
  kind: "message",
  message: { id, role: "user", text, senderThreadId: from },
});
const person = (id: string, text: string): Entry => ({
  kind: "message",
  message: { id, role: "user", text },
});
const sent = (id: string, to: string, message: string, status = "completed"): Entry => ({
  kind: "work",
  entry: {
    id,
    structuredPayload: {
      type: "dynamic_tool",
      toolName: "mcp__t3-code__t3_thread_send",
      status,
      input: { threadId: to, message, mode: "auto" },
    },
  },
});

describe("a message's gist", () => {
  it("is its first sentence, the rest after it", () => {
    expect(gistOf("Can I take migration 0043? It's the next free number.")).toEqual({
      gist: "Can I take migration 0043?",
      rest: "It's the next free number.",
    });
    expect(gistOf("Main is green again")).toEqual({ gist: "Main is green again", rest: "" });
    expect(gistOf("Took it\nDetails below.")).toEqual({ gist: "Took it", rest: "Details below." });
  });

  it("keeps a dot inside a word, a path or a version", () => {
    expect(gistOf("Bumped vite to 6.2.1 in apps/web/package.json. Rebase.").gist).toBe(
      "Bumped vite to 6.2.1 in apps/web/package.json.",
    );
  });

  it("drops a self-introduction: the card names the sender", () => {
    expect(gistOf("Otter here. Can I take 0043?").gist).toBe("Can I take 0043?");
  });

  it("cuts a long first sentence at a word, and carries the cut over", () => {
    const words = "word ".repeat(40).trim();
    const { gist, rest } = gistOf(words);
    expect(gist.length).toBeLessThanOrEqual(91);
    expect(gist.endsWith("word…")).toBe(true);
    expect(rest.startsWith("…word")).toBe(true);
  });
});

describe("messages between Cells, from one chat", () => {
  it("pairs an ask that came in with this Cell's reply", () => {
    const notes = exchangeOf([
      incoming("m1", "otter", "Can I take migration 0043?"),
      person("m2", "Go on."),
      sent("t1", "otter", "Yes, take it. I'm on 0044."),
    ]);
    expect(notes.get("m1")).toMatchObject({
      way: "in",
      cell: "otter",
      kind: "ask",
      answered: true,
    });
    expect(notes.get("t1")).toMatchObject({
      way: "out",
      kind: "reply",
      answers: "Can I take migration 0043?",
      gist: "Yes, take it.",
      rest: "I'm on 0044.",
    });
    expect(notes.has("m2")).toBe(false);
  });

  it("pairs this Cell's ask with the answer that comes back", () => {
    const notes = exchangeOf([
      sent("t1", "badger", "Are you editing checkout.ts?"),
      incoming("m1", "badger", "No, it's yours."),
    ]);
    expect(notes.get("t1")).toMatchObject({ kind: "ask", answered: true });
    expect(notes.get("m1")).toMatchObject({
      kind: "reply",
      answers: "Are you editing checkout.ts?",
    });
  });

  it("leaves an ask open while nothing went back, and a heads-up as news", () => {
    const notes = exchangeOf([
      incoming("m1", "otter", "Merged #88 to main."),
      incoming("m2", "otter", "Can you rebase?"),
      sent("t1", "badger", "Heads up: main moved."),
    ]);
    expect(notes.get("m1")).toMatchObject({ kind: "says" });
    expect(notes.get("m2")).toMatchObject({ kind: "ask", answered: false });
    expect(notes.get("t1")).toMatchObject({ kind: "says" });
  });

  it("keeps each Cell's exchange apart", () => {
    const notes = exchangeOf([
      incoming("m1", "otter", "Can I take 0043?"),
      sent("t1", "badger", "Done with schema.ts."),
    ]);
    expect(notes.get("m1")).toMatchObject({ answered: false });
    expect(notes.get("t1")).toMatchObject({ kind: "says", answers: null });
  });

  it("reads a send that failed as nothing sent", () => {
    expect(
      sentOf({
        type: "dynamic_tool",
        toolName: "t3_thread_send",
        status: "failed",
        input: { threadId: "x", message: "hi" },
      }),
    ).toBeNull();
    expect(
      sentOf({ type: "dynamic_tool", toolName: "t3_thread_read", input: { threadId: "x" } }),
    ).toBeNull();
    expect(
      sentOf({
        type: "dynamic_tool",
        toolName: "t3_thread_send",
        status: "completed",
        input: { threadId: "x", message: "hi" },
      }),
    ).toEqual({ to: "x", text: "hi" });
  });

  it("pairs mail from a Cell on a linked machine with this Cell's answer to it", () => {
    const mail = "stemcells-peer:environment-studio:thread-puma:request-1";
    expect(senderOf({ id: mail, role: "user" })).toEqual({
      cell: "thread-puma",
      machine: "environment-studio",
    });
    expect(senderOf({ id: "message-1", role: "user" })).toBeNull();
    const notes = exchangeOf([
      { kind: "message", message: { id: mail, role: "user", text: "Can I take the auth module?" } },
      {
        kind: "work",
        entry: {
          id: "t1",
          structuredPayload: {
            type: "dynamic_tool",
            toolName: "mcp__t3-code__stemcells_peer_send",
            status: "completed",
            input: { threadId: "thread-puma", message: "Yes, it's yours." },
          },
        },
      },
    ]);
    expect(notes.get(mail)).toMatchObject({
      way: "in",
      cell: "thread-puma",
      kind: "ask",
      answered: true,
    });
    expect(notes.get("t1")).toMatchObject({ way: "out", kind: "reply" });
  });
});
