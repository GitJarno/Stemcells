import { describe, expect, it } from "vite-plus/test";

import { closesOnReturn } from "./closesOnReturn";

const LEFT = Date.parse("2026-10-30T09:00:00.000Z");
const settle = (threadId: string, at: string) => ({ threadId, at });

describe("a chat open when the phone comes back", () => {
  it.each([
    ["closes for a settle by hand while away", [settle("otter", "2026-10-30T11:00:00.000Z")], true],
    [
      "stays for one from before it left, opened settled on purpose",
      [settle("otter", "2026-10-30T08:00:00.000Z")],
      false,
    ],
    ["stays for an automatic settle, which the list leaves out", [], false],
    ["stays for another Cell's settle", [settle("pip", "2026-10-30T11:00:00.000Z")], false],
    ["stays with a server from before settles", undefined, false],
  ])("%s", (_, settles, closes) => {
    expect(closesOnReturn({ shown: "otter", awaySince: LEFT, settles })).toBe(closes);
  });
});
