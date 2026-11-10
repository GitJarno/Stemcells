import { describe, expect, it } from "vite-plus/test";

import { previewOf, previewsOf, shownOf } from "./preview";

describe("how a preview is drawn", () => {
  it("draws one with no fence as written, its columns and indents kept", () => {
    const mockup = "\n  +------+\n  | Save |\n  +------+\nTitle\n-----\n\n";
    expect(previewOf(mockup)).toEqual({
      as: "written",
      text: "  +------+\n  | Save |\n  +------+\nTitle\n-----",
    });
  });

  it("hands one the agent fenced to the markdown renderer", () => {
    for (const text of ["```ts\nconst on = true;\n```", "Two columns:\n\n   ~~~\n a | b\n   ~~~"])
      expect(previewOf(text)).toEqual({ as: "markdown", text });
    // Backticks inside a line open no fence.
    expect(previewOf("run ```now``` or later")?.as).toBe("written");
  });

  it("has none for a missing or blank preview", () => {
    for (const none of [undefined, null, "", " \n\t\n"]) expect(previewOf(none)).toBeNull();
  });
});

describe("a question's previews", () => {
  it("are none when no option has one, so the question draws as it always did", () => {
    expect(previewsOf([{}, { preview: "  " }, { preview: null }])).toBeNull();
  });

  it("keep the options' order, with a gap where an option has none", () => {
    expect(previewsOf([{}, { preview: "[ A ]" }])).toEqual([
      null,
      { as: "written", text: "[ A ]" },
    ]);
  });
});

describe("whose preview shows", () => {
  const previews = previewsOf([{}, { preview: "[ A ]" }, { preview: "[ B ]" }])!;

  it("starts on the first option that has one", () => {
    expect(shownOf(previews, "q1", null)).toBe(1);
  });

  it("follows the highlighted option, one with no preview too", () => {
    expect(shownOf(previews, "q1", { questionId: "q1", index: 2 })).toBe(2);
    expect(shownOf(previews, "q1", { questionId: "q1", index: 0 })).toBe(0);
  });

  it("starts over on the next question, and for a row past the options", () => {
    expect(shownOf(previews, "q2", { questionId: "q1", index: 2 })).toBe(1);
    expect(shownOf(previews, "q1", { questionId: "q1", index: 3 })).toBe(1);
  });
});
