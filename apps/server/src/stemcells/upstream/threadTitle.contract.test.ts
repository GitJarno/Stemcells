/**
 * Server behaviour the line over a Cell's composer relies on. It shows the
 * thread's title as what the chat is about, as it comes, because upstream
 * asks a model for a short title rather than cutting the first message. If
 * this fails after a sync, the title may be a cut message again, and the
 * line needs a summary of its own.
 */
import { buildThreadTitlePrompt } from "@t3tools/provider-core/server/textGenerationPrompts";
import { sanitizeThreadTitle } from "@t3tools/provider-core/server/textGenerationUtils";
import { describe, expect, it } from "vite-plus/test";

describe("upstream's thread title", () => {
  it("is asked of a model as a few words, never the message cut short", () => {
    for (const previousTitle of [undefined, "Earlier title"]) {
      const { prompt } = buildThreadTitlePrompt({ message: "Hello", previousTitle });
      expect(prompt).toContain("3-8 words, fewer than 40 characters.");
      expect(prompt).toMatch(/Do not copy and truncate (the user's message|a thread message)\./);
    }
  });

  it("is one line, and the placeholder when the model gives none", () => {
    expect(sanitizeThreadTitle("  Composer  line\nsecond line")).toBe("Composer line");
    expect(sanitizeThreadTitle("   ")).toBe("New thread");
  });
});
