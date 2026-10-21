import { describe, expect, it } from "vite-plus/test";

import { type BeforeSend, oneSendAtATime, type Sending, sendSlots } from "./send";

const sending = (hold: boolean): Sending => ({
  hold,
  ready: null,
  foreground: false,
  edit: () => null,
});

// One slot held one BeforeSend, so a second reader in the same composer
// (answers to Aski's cards beside the words) replaced the first, and the
// first one's cleanup unset the second.
describe("a composer's send slots", () => {
  it("asks answers before the words, and the first that changes the send decides it", () => {
    const slots = sendSlots();
    const asked: string[] = [];
    const words: BeforeSend = () => {
      asked.push("words");
      return sending(false);
    };
    const answers: BeforeSend = () => {
      asked.push("answers");
      return sending(true);
    };
    slots.register("words", words);
    slots.register("answers", answers);
    expect(slots.ask(undefined)?.hold).toBe(true);
    expect(asked).toEqual(["answers"]);
  });

  it("goes on to the words when the answers change nothing", () => {
    const slots = sendSlots();
    slots.register("answers", () => null);
    slots.register("words", () => sending(false));
    expect(slots.ask("foreground")?.hold).toBe(false);
  });

  it("takes back only what its own registration put there", () => {
    const slots = sendSlots();
    const first = slots.register("words", () => sending(true));
    const answers = slots.register("answers", () => null);
    // The words register again (a new render) before the old one cleans up.
    slots.register("words", () => sending(false));
    first();
    expect(slots.ask(undefined)?.hold).toBe(false);
    answers();
    expect(slots.ask(undefined)?.hold).toBe(false);
  });

  it("changes nothing when no one is registered", () => {
    expect(sendSlots().ask(undefined)).toBeNull();
  });
});

/** A wait the test settles by hand. */
function wait() {
  let settle: { resolve: () => void; reject: (error: Error) => void } | null = null;
  const ready = new Promise<void>((resolve, reject) => {
    settle = { resolve, reject };
  });
  return { ready, settle: settle! };
}

// The composer froze: a send waiting on Aski's plan whose wait failed held
// every later Enter, since nothing let go (#173's review).
describe("a composer's sends, one at a time", () => {
  it("goes at once with nothing to wait for", () => {
    const queue = oneSendAtATime();
    let sent = 0;
    queue.send(null, () => sent++);
    expect(sent).toBe(1);
    expect(queue.waiting()).toBe(false);
  });

  it("takes no other while one waits, and goes once the wait is over", async () => {
    const queue = oneSendAtATime();
    const { ready, settle } = wait();
    let sent = 0;
    queue.send(ready, () => sent++);
    expect(queue.waiting()).toBe(true);
    settle.resolve();
    // The queue reacted to the wait before the test did, so it has gone by now.
    await ready;
    expect(sent).toBe(1);
    expect(queue.waiting()).toBe(false);
  });

  it("sends nothing when the wait fails, and takes the next send", async () => {
    const queue = oneSendAtATime();
    const { ready, settle } = wait();
    let sent = 0;
    queue.send(ready, () => sent++);
    settle.reject(new Error("the plan broke"));
    await ready.catch(() => {});
    expect(sent).toBe(0);
    expect(queue.waiting()).toBe(false);
    queue.send(null, () => sent++);
    expect(sent).toBe(1);
  });
});
