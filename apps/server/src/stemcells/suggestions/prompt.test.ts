import { describe, expect, it } from "vite-plus/test";

import { cleanSuggestion, suggestionPrompt } from "./prompt.ts";

describe("cleanSuggestion", () => {
  it("keeps a next step the person would send, without its wrapping", () => {
    expect(cleanSuggestion("run the tests and commit")).toBe("run the tests and commit");
    expect(cleanSuggestion('  "go ahead"  ')).toBe("go ahead");
    expect(cleanSuggestion("<suggestion>yes</suggestion>")).toBe("yes");
    expect(cleanSuggestion("Suggestion: open a PR")).toBe("open a PR");
  });

  it("drops what the person wouldn't send", () => {
    for (const raw of [
      "",
      "none",
      "Nothing to suggest.",
      "thanks!",
      "Looks good",
      "Let me run the tests",
      "I'll commit this now",
      "Fix the bug. Then deploy it.",
      "run the tests\ncommit",
      "- run the tests",
      "please run every single test in the whole repository again and then commit all of it",
    ]) {
      expect(cleanSuggestion(raw), raw).toBeNull();
    }
  });
});

describe("suggestionPrompt", () => {
  it("reads the reply's end and the person's last four messages", () => {
    const reply = `${"Earlier work. ".repeat(1_000)}Want me to open a PR?`;
    const prompt = suggestionPrompt({
      userMessages: ["first", "second", "third", "fourth", "fifth"],
      reply,
    });
    expect(prompt).toContain("Want me to open a PR?");
    expect(prompt.length).toBeLessThan(reply.length);
    expect(prompt).not.toContain("<message>\nfirst\n</message>");
    expect(prompt).toContain("<message>\nfifth\n</message>");
  });
});
