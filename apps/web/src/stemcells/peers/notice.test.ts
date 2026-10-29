import { describe, expect, it } from "vite-plus/test";

import { collisionOf, filesOf } from "./notice";

// The id the server gave a collision notice, as past chats keep it.
const NOTICE_ID = "stemcells-collision:file:thread%3Abadger:nonce-1";

describe("a collision notice, read off its message", () => {
  it("names its kind and the other Cell", () => {
    expect(collisionOf(NOTICE_ID)).toEqual({ kind: "file", other: "thread:badger" });
    expect(collisionOf("stemcells-collision:checkout:t-2:n")).toEqual({
      kind: "checkout",
      other: "t-2",
    });
  });

  it("is no notice for any other message", () => {
    expect(collisionOf("message:person")).toBeNull();
    expect(collisionOf("stemcells-continued:limit:t:r:n")).toBeNull();
    expect(collisionOf("stemcells-collision:file:%E0%A4%A:n")).toBeNull();
  });

  it("takes the files from its first line", () => {
    expect(filesOf("⚠ Same file as Badger: src/a.ts, src/b.ts\nStemcells saw this…")).toBe(
      "src/a.ts, src/b.ts",
    );
    expect(filesOf("⚠ Same checkout as Badger\nStemcells saw this…")).toBe("");
  });
});
