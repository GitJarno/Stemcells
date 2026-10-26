import { describe, expect, it } from "vite-plus/test";

import { within, type WaitEnd } from "./wait";

/** Work that answers only when it's told to, and remembers whether it was stopped. */
function hanging() {
  const seen: { stopped: boolean } = { stopped: false };
  const work = (signal: AbortSignal) =>
    new Promise<string>(() => {
      signal.addEventListener("abort", () => {
        seen.stopped = true;
      });
    });
  return { seen, work };
}

const said = (end: WaitEnd) => `none (${end})`;

// The composer froze: a planner request that never answered held Enter
// forever. Every wait ends.
describe("a wait on the planner", () => {
  it("gives the work's answer when it comes in time", async () => {
    const answer = await within(async () => "lines", said, new AbortController().signal, 1_000);
    expect(answer).toBe("lines");
  });

  it("ends at its time, and stops the work", async () => {
    const { seen, work } = hanging();
    expect(await within(work, said, new AbortController().signal, 10)).toBe("none (late)");
    expect(seen.stopped).toBe(true);
  });

  it("ends when the words change or Esc drops the plan, with no time limit", async () => {
    const { seen, work } = hanging();
    const plan = new AbortController();
    const waiting = within(work, said, plan.signal, null);
    plan.abort();
    expect(await waiting).toBe("none (aborted)");
    expect(seen.stopped).toBe(true);
  });

  it("never starts work for a plan already dropped", async () => {
    const plan = new AbortController();
    plan.abort();
    let started = false;
    const answer = await within(
      async () => {
        started = true;
        return "lines";
      },
      said,
      plan.signal,
      1_000,
    );
    expect(answer).toBe("none (aborted)");
    expect(started).toBe(false);
  });

  it("never rejects: work that throws gives the fallback", async () => {
    const signal = new AbortController().signal;
    expect(await within(() => Promise.reject(new Error("down")), said, signal, 1_000)).toBe(
      "none (failed)",
    );
    expect(
      await within(
        () => {
          throw new Error("down");
        },
        said,
        signal,
        1_000,
      ),
    ).toBe("none (failed)");
  });
});
