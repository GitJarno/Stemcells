import { describe, expect, it } from "vite-plus/test";

import { NOTHING_TAKEN, placesOf, wordsStep } from "./place";

const places = placesOf([
  { key: "harbor", name: "Harbor", projects: ["mac:harbor", "mini:harbor"] },
  { key: "harbor-design", name: "Harbor Design", projects: ["mac:hd"] },
  { key: "atlas", name: "Atlas", projects: ["mac:atlas"] },
]);

describe("a new chat on the phone follows its words to a project", () => {
  it("moves to the project named, on the draft's own machine, and back when the name goes", () => {
    const named = wordsStep("Harbor: fix the header", places, "mini:atlas", NOTHING_TAKEN);
    expect(named.move).toBe("mini:harbor");
    const gone = wordsStep("fix the header", places, "mini:harbor", named.taken);
    expect(gone.move).toBe("mini:atlas");
    expect(gone.taken).toEqual(NOTHING_TAKEN);
  });

  it("moves on to the longer name as it is typed", () => {
    const first = wordsStep("Harbor", places, "mac:atlas", NOTHING_TAKEN);
    expect(first.move).toBe("mac:harbor");
    const longer = wordsStep("Harbor Design", places, "mac:harbor", first.taken);
    expect(longer.move).toBe("mac:hd");
    expect(wordsStep("", places, "mac:hd", longer.taken).move).toBeNull();
  });

  it("writes a project picked by hand over the name, and then stays there", () => {
    const named = wordsStep("fix the header in Harbor", places, "mac:atlas", NOTHING_TAKEN);
    const picked = wordsStep("fix the header in Harbor", places, "mac:hd", named.taken);
    expect(picked).toMatchObject({ move: null, text: "fix the header in Harbor Design" });
    expect(wordsStep(picked.text!, places, "mac:hd", picked.taken).move).toBeNull();
  });

  it("keeps a casual chat picked by hand, which no name says, over the name", () => {
    const named = wordsStep("fix the header in Harbor", places, "mac:atlas", NOTHING_TAKEN);
    const casual = wordsStep("fix the header in Harbor", places, "mac:scratch", named.taken);
    expect(casual).toMatchObject({ move: null, text: null });
    const typed = wordsStep("fix the header in Harbor now", places, "mac:scratch", casual.taken);
    expect(typed.move).toBeNull();
    expect(wordsStep("fix the header", places, "mac:scratch", typed.taken).move).toBeNull();
  });

  it("leaves a name the sentence only mentions", () => {
    expect(
      wordsStep("port the parser from Atlas", places, "mac:harbor", NOTHING_TAKEN).move,
    ).toBeNull();
  });
});
