import { describe, expect, it } from "vite-plus/test";

import { firstParagraph, LINE_MOST } from "./lines.ts";

describe("a project's line", () => {
  it("is the first paragraph of prose, past the heading and the badges", () => {
    const text = [
      "# Harbor",
      "",
      "[![build](https://example.com/b.svg)](https://example.com)",
      "",
      "The **booking** service for the",
      "[ferry](https://example.com/ferry) timetable, in `Go`.",
      "",
      "A second paragraph.",
    ].join("\n");
    expect(firstParagraph(text)).toBe("The booking service for the ferry timetable, in Go.");
  });

  it("skips front matter, comments, imports, code and lists", () => {
    const text = [
      "---",
      "title: Atlas",
      "---",
      "<!-- generated -->",
      "@AGENTS.md",
      "",
      "```sh",
      "make atlas",
      "```",
      "- a list item",
      "",
      "Maps for the field team.",
    ].join("\n");
    expect(firstParagraph(text)).toBe("Maps for the field team.");
  });

  it("is null when the file holds no prose", () => {
    expect(firstParagraph("# Kestrel\n\n- one\n- two\n")).toBeNull();
    expect(firstParagraph("")).toBeNull();
  });

  it("is cut at a word near the most a line holds", () => {
    const line = firstParagraph(`${"word ".repeat(80)}end`)!;
    expect(line.length).toBeLessThanOrEqual(LINE_MOST);
    expect(line.endsWith("word…")).toBe(true);
  });
});
