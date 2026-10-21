import { describe, expect, it } from "vite-plus/test";

import { modelLexicon } from "../catalog";
import { testCatalog, testPlaces } from "../fixtures/catalog";
import { roster } from "../places";
import { readWords } from "../read";
import { INSTRUCTIONS, markedText, MOST_PROJECTS, plannerPrompt, type PlanAsk } from "./ask";

const ask: PlanAsk = {
  text: "spawn 2 Sol: fix the header [keep the logo] and tidy the footer",
  task: "fix the header [keep the logo] and tidy the footer",
  verbatims: [{ start: 28, end: 43, text: "keep the logo" }],
  cells: [
    { model: "Sol 6.1", effort: null, place: "Harbor" },
    { model: "Sol 6.1", effort: "High", place: null },
  ],
  projects: Array.from({ length: 14 }, (_, i) => ({
    name: `Place${i + 1}`,
    line: i === 0 ? "The ferry timetable." : null,
  })),
};

describe("what the planner is asked", () => {
  // In the Swift app a word of the instructions that was also a project's
  // name lost the place in 2 of 6 runs (decision 11). The test roster is
  // named with everyday words (Reviews, Board, Relay, Sales).
  it("name no project of the roster", () => {
    const facts = readWords(INSTRUCTIONS, {
      door: "draft",
      roster: roster(testPlaces),
      models: modelLexicon(testCatalog),
    });
    expect(facts.mentions.map((place) => place.place.name)).toEqual([]);
    expect(facts.routing).toEqual([]);
  });

  it("marks each [bracketed] passage the words carry word for word", () => {
    expect(markedText(ask)).toBe(
      "spawn 2 Sol: fix the header ⟦P1⟧keep the logo⟦/P1⟧ and tidy the footer",
    );
  });

  it("gives each chip its words, as upstream sends them", () => {
    expect(
      markedText({ text: "fix ￼ and ￼", verbatims: [], chips: ["@src/a.ts", "@src/b.ts"] }),
    ).toBe("fix @src/a.ts and @src/b.ts");
  });

  it("lists the Cells with their places open or set, and at most twelve projects", () => {
    const prompt = plannerPrompt(ask);
    expect(prompt).toContain("1. model Sol 6.1, effort default, place Harbor");
    expect(prompt).toContain("2. model Sol 6.1, effort High, place open");
    expect(prompt).toContain("- Place1: The ferry timetable.");
    expect(prompt).toContain(`- Place${MOST_PROJECTS}`);
    expect(prompt).not.toContain(`Place${MOST_PROJECTS + 1}`);
  });

  it("names what failed when it asks again", () => {
    expect(plannerPrompt(ask, ["Cell 2 has no answer."])).toContain(
      "Your last answer failed these checks; answer again, fixing them:\n- Cell 2 has no answer.",
    );
    expect(plannerPrompt(ask)).not.toContain("failed these checks");
  });
});
