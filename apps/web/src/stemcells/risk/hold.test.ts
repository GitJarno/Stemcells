import { describe, expect, it } from "vite-plus/test";

import { holdLines } from "./hold";

const triggers = (words: string, briefs: string[]) =>
  holdLines([words], briefs).map((line) =>
    line.sentence.slice(line.trigger.start, line.trigger.end),
  );

describe("what a plan holds for", () => {
  it("passes a risky act the person wrote, in their words", () => {
    expect(
      triggers("fix the header, then force push the fix", ["Your part: force push the fix."]),
    ).toEqual([]);
    expect(
      triggers("Delete the old feature branches in Harbor", ["Delete the old feature branches."]),
    ).toEqual([]);
  });

  it("asks about an act Aski added, or put in words of its own", () => {
    expect(triggers("tidy up the branches", ["Delete the old feature branches."])).toEqual([
      "Delete the old feature branches",
    ]);
    expect(triggers("force push the fix", ["Force-push it with the fix."])).toEqual(["Force-push"]);
  });

  it("asks when Aski dropped the person's don't", () => {
    expect(
      triggers("fix the header but don't force push", ["Fix the header, then force push."]),
    ).toEqual(["force push"]);
  });

  it("passes what a prompt itself says not to do", () => {
    expect(triggers("fix the header", ["Fix the header. Don't force push."])).toEqual([]);
  });

  it("asks once for a clause several prompts share, and says whose it is", () => {
    const lines = holdLines(
      ["fix the header"],
      ["Fix the header, then: deploy to production.", "Deploy to production."],
    );
    expect(lines.map((line) => [line.kind, line.brief, line.sentence])).toEqual([
      ["release", 0, "Fix the header, then: deploy to production."],
    ]);
  });

  it("reads what the person attached as theirs too", () => {
    expect(
      holdLines(["see the notes", "Steps: rotate the API keys"], ["Rotate the API keys."]),
    ).toEqual([]);
  });
});
