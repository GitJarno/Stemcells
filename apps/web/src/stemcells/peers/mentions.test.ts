import { describe, expect, it } from "vite-plus/test";

import { linkCellNames, namesOf } from "./mentions";

const names = new Map([
  ["Manatee", "thread-m"],
  ["Fox", "thread-f"],
]);
const link = (name: string, id: string) => `[${name}](t3-context://v1/stemcells-cell/${id})`;

describe("another Cell named in a chat's words", () => {
  it.each([
    [
      "Only brand pages drop; Manatee is hiding the third.",
      `Only brand pages drop; ${link("Manatee", "thread-m")} is hiding the third.`,
    ],
    ["Ask @Fox first.", `Ask ${link("Fox", "thread-f")} first.`],
    ["**Manatee**'s branch", `**${link("Manatee", "thread-m")}**'s branch`],
    ["- Fox: done", `- ${link("Fox", "thread-f")}: done`],
    ["Foxes and Manatees, firefox, fox", "Foxes and Manatees, firefox, fox"],
    ["See `Manatee` and src/Fox.ts and #Fox", "See `Manatee` and src/Fox.ts and #Fox"],
    [
      "[Manatee](https://example.com) at https://example.com/Fox",
      "[Manatee](https://example.com) at https://example.com/Fox",
    ],
    ["```\nManatee\n```\nManatee", `\`\`\`\nManatee\n\`\`\`\n${link("Manatee", "thread-m")}`],
    ["text\n\n    Manatee()", "text\n\n    Manatee()"],
  ])("%j", (text, linked) => {
    expect(linkCellNames(text, names)).toBe(linked);
  });

  it("means the Cell active last when two share a name, and skips an id a link can't carry", () => {
    expect(
      namesOf([
        { id: "old", name: "Fox", updatedAt: "2026-10-01T10:00:00.000Z" },
        { id: "new", name: "Fox", updatedAt: "2026-10-30T10:00:00.000Z" },
        { id: "not/an id", name: "Orca", updatedAt: "2026-10-30T10:00:00.000Z" },
      ]),
    ).toEqual(new Map([["Fox", "new"]]));
  });
});
