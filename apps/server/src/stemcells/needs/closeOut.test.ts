import { describe, expect, it } from "vite-plus/test";

import { readCloseOut, stopOf } from "./closeOut.ts";

describe("a Cell's close-out", () => {
  it("reads Done as delivered, with its line", () => {
    const stop = stopOf(
      "Fixed the overlap and merged it.\n\n**Done:** the header fix, merged as #12",
    );
    expect(stop).toEqual({ ask: null, waits: false, line: "the header fix, merged as #12" });
  });

  it("reads the label however it is set off", () => {
    for (const line of [
      "**Done:** shipped",
      "**Done**: shipped",
      "Done: shipped",
      "- Done: shipped",
      "__Done:__ shipped",
    ]) {
      expect(readCloseOut(`Work.\n\n${line}`).closeOut).toEqual({ kind: "done", text: "shipped" });
    }
  });

  it("makes the person's step a card, and a step with no owner too", () => {
    expect(stopOf("Built it.\n\n**Left:** you — run the sign-in with Drive access")).toEqual({
      ask: { cue: "left", text: "run the sign-in with Drive access" },
      waits: false,
      line: "run the sign-in with Drive access",
    });
    expect(stopOf("**Left:** the deploy key")).toMatchObject({
      ask: { cue: "left", text: "the deploy key" },
    });
  });

  it("keeps a Cell that waits on its own step or on something else at work", () => {
    expect(stopOf("**Left:** waiting — the merge check on #212")).toEqual({
      ask: null,
      waits: true,
      line: "the merge check on #212",
    });
    expect(stopOf("**Left:** me - rerun the suite once #1123 lands")).toMatchObject({
      ask: null,
      waits: true,
    });
  });

  it("puts the person's Left first, whatever order the lines come in", () => {
    const reply = [
      "Two things left.",
      "",
      "**Left:** waiting — CI on #40",
      "**Left:** you — approve the billing change",
      "**Done:** the migration",
    ].join("\n");
    expect(stopOf(reply).ask).toEqual({ cue: "left", text: "approve the billing change" });
  });

  it("lets a real question beat a Done, but not an offer of more work", () => {
    expect(
      stopOf("Should the export keep the old column or drop it?\n\n**Done:** the export").ask,
    ).toMatchObject({ cue: "question" });
    expect(
      stopOf("**Done:** the header fix, merged as #12\nWant me to restyle the footer too?").ask,
    ).toBeNull();
    expect(stopOf("**Done:** the parser\n\nNext, I'll add the cards.").ask).toBeNull();
  });

  it("reads a Left that names nothing as no Left", () => {
    expect(stopOf("**Done:** all of it\n**Left:** none").ask).toBeNull();
    expect(stopOf("**Left:** nothing.").ask).toBeNull();
  });

  it("takes no close-out from code, or from far up a long reply", () => {
    const fenced = "Here is the template:\n\n```\n**Left:** you — fill this in\n```\n\nAll merged.";
    expect(readCloseOut(fenced).closeOut).toBeNull();
    const early = ["**Done:** step one", ...Array.from({ length: 8 }, (_, i) => `Line ${i}.`)];
    expect(readCloseOut(early.join("\n")).closeOut).toBeNull();
  });

  it("falls back to the pre-read without one", () => {
    expect(stopOf("Tests pass.\n\nShould I push it?").ask).toMatchObject({ cue: "offer" });
    expect(stopOf("Fixed and pushed.")).toEqual({ ask: null, waits: false, line: null });
  });
});
