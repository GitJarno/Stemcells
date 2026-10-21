import { describe, expect, it } from "vite-plus/test";

import type { PlanAsk } from "./ask";
import { checkAnswer } from "./check";

const ask: PlanAsk = {
  text: "spawn 2 Sol: fix the header [keep the logo]. Then tidy the footer links",
  task: "fix the header [keep the logo]. Then tidy the footer links",
  verbatims: [{ start: 28, end: 43, text: "keep the logo" }],
  cells: [
    { model: "Sol 6.1", effort: null, place: "Harbor" },
    { model: "Sol 6.1", effort: null, place: null },
  ],
  projects: [],
};
const roster = ["Harbor", "Atlas", "Kestrel"].map((name) => ({ id: name.toLowerCase(), name }));

const good = {
  cells: [
    { cell: 1, title: "Header", prompt: "Fix the header, and keep the logo." },
    { cell: 2, title: "Footer", prompt: "Tidy the footer links.", project: "atlas" },
  ],
};

const failedOf = (answer: unknown) => {
  const checked = checkAnswer(answer, ask, roster);
  return checked.ok ? [] : checked.failed;
};

describe("a plan's checks", () => {
  it("pass an answer that fills only what was open, with every part placed", () => {
    expect(checkAnswer(good, ask, roster)).toEqual({
      ok: true,
      cells: [
        { title: "Header", prompt: "Fix the header, and keep the logo.", project: null },
        { title: "Footer", prompt: "Tidy the footer links.", project: roster[1] },
      ],
    });
  });

  it("answer every Cell once, and no other", () => {
    expect(
      failedOf({ cells: [good.cells[0], good.cells[0], { ...good.cells[1], cell: 3 }] }),
    ).toEqual(
      expect.arrayContaining([
        "Cell 1 is answered twice.",
        "There is no Cell 3.",
        "Cell 2 has no answer.",
      ]),
    );
    expect(failedOf({ answer: "no" })).toEqual(["The answer isn't in the asked shape."]);
  });

  it("let Aski pick a place only where the words left it open, from the roster", () => {
    const moved = { cells: [{ ...good.cells[0], project: "Atlas" }, good.cells[1]] };
    expect(failedOf(moved)).toContain("Cell 1's place is set by the words; it takes no project.");
    const unplaced = { cells: [good.cells[0], { ...good.cells[1], project: undefined }] };
    expect(failedOf(unplaced)).toContain("Cell 2's place is open; name its project.");
    const elsewhere = { cells: [good.cells[0], { ...good.cells[1], project: "Mars" }] };
    expect(failedOf(elsewhere)).toContain('"Mars" is no project here.');
  });

  it("keep each [bracketed] passage word for word, in one prompt", () => {
    const lost = { cells: [{ ...good.cells[0], prompt: "Fix the header." }, good.cells[1]] };
    expect(failedOf(lost)).toContain("⟦P1⟧ is in no prompt word for word.");
    const twice = {
      cells: [good.cells[0], { ...good.cells[1], prompt: "Tidy the footer links; keep the logo." }],
    };
    expect(failedOf(twice)).toContain("⟦P1⟧ is in more than one prompt.");
  });

  it("drop no part of the message", () => {
    const dropped = { cells: [good.cells[0], { ...good.cells[1], prompt: "Look around." }] };
    expect(failedOf(dropped)).toContain('This part is in no prompt: "Then tidy the footer links"');
  });

  it("want short titles and a prompt for each Cell", () => {
    const long = { cells: [{ ...good.cells[0], title: "x".repeat(61) }, good.cells[1]] };
    expect(failedOf(long)).toContain("Cell 1's title is too long.");
    const empty = { cells: [good.cells[0], { ...good.cells[1], prompt: " " }] };
    expect(failedOf(empty)).toContain("Cell 2 has no prompt.");
  });
});
