import { describe, expect, it } from "vite-plus/test";

import { cellNameOf } from "../cell/name";
import { linkCellNames, namesFor } from "./mentions";

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

  it("names the other Cells of the chat's project, the one active last of two", () => {
    const chat = (
      id: string,
      facts: Partial<{ projectId: string; updatedAt: string; gone: boolean; aski: boolean }> = {},
    ) => ({
      environmentId: "env",
      id,
      projectId: facts.projectId ?? "shop",
      gone: facts.gone ?? false,
      aski: facts.aski ?? false,
      updatedAt: facts.updatedAt ?? "2026-10-30T10:00:00.000Z",
    });
    const self = chat("self");
    // Two ids that draw one name, by cellNameOf's deal.
    const [older, newer] = twins();
    const names = namesFor(self, [
      self,
      chat(older, { updatedAt: "2026-10-01T10:00:00.000Z" }),
      chat(newer),
      chat("elsewhere", { projectId: "harbor" }),
      chat("archived", { gone: true }),
    ]);
    expect([...names.values()]).toEqual([newer]);
    expect(
      namesFor({ ...self, aski: true }, [chat("elsewhere", { projectId: "harbor" })]).size,
    ).toBe(1);
  });
});

function twins(): [string, string] {
  const seen = new Map<string, string>();
  for (let index = 0; ; index += 1) {
    const id = `thread-${index}`;
    const name = cellNameOf(id);
    const first = seen.get(name);
    if (first !== undefined) return [first, id];
    seen.set(name, id);
  }
}
