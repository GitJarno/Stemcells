import { describe, expect, it } from "vite-plus/test";

import { cellNameOf } from "../cell/name";
import { peerNameOf, sentLabel } from "./names";

describe("what a chat calls another", () => {
  it("calls a Cell by the name its tab shows, and Aski by its own", () => {
    expect(peerNameOf("thread-1", { providerInstanceId: "codex", parentThreadId: null })).toBe(
      cellNameOf("thread-1"),
    );
    expect(peerNameOf("thread-2", { providerInstanceId: "aski", parentThreadId: null })).toBe(
      "Aski",
    );
    // A chat started below Aski's is a Cell like any.
    expect(peerNameOf("thread-3", { providerInstanceId: "aski", parentThreadId: "thread-2" })).toBe(
      cellNameOf("thread-3"),
    );
  });

  it("says what a send did, to whom, with its gist", () => {
    expect(sentLabel({ to: "thread-1", text: "Can I take 0043? It's next." })).toBe(
      `Asked ${cellNameOf("thread-1")}: Can I take 0043?`,
    );
    expect(sentLabel({ to: "thread-1", text: "Took 0044.\nDetails…" })).toBe(
      `Wrote to ${cellNameOf("thread-1")}: Took 0044.`,
    );
  });
});
