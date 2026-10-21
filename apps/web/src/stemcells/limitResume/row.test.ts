import { describe, expect, it } from "vite-plus/test";

import { CONTINUED_WORDS, continuedWords } from "./row";

describe("the row a Cell that carried on after a limit shows", () => {
  it("says why, from the server's message id", () => {
    expect(continuedWords("stemcells-continued:signed-in:thread-otter:run-1:nonce-1")).toBe(
      "Continued after you signed in again",
    );
    expect(continuedWords("stemcells-continued:reset:thread-otter:run-1:nonce-2")).toBe(
      CONTINUED_WORDS.reset,
    );
  });

  it("says the reset for upstream's own resume, once it's armed", () => {
    expect(continuedWords("limit-resume:thread-otter:run-1:1760000000000:legacy")).toBe(
      "Continued after the limit reset",
    );
  });

  it("leaves every other message as the person wrote it", () => {
    expect(continuedWords("message-1")).toBeNull();
    expect(continuedWords("stemcells-continued:other:thread-otter:run-1:nonce-3")).toBeNull();
  });
});
