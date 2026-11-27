import { describe, expect, it } from "vite-plus/test";

import { hearName } from "./byEar.ts";
import { FILLER } from "./question.ts";

const PROJECTS = ["Harbor", "Atlas", "Ledger", "Vacuum Cleaners"].map((name) => ({
  item: name,
  name,
}));

const heard = (text: string) => {
  const match = hearName(text, PROJECTS, FILLER);
  return match === null ? null : [match.item, match.heard];
};

describe("a project named by ear", () => {
  it.each([
    ["what did we do in harbour this week", "Harbor", "harbour"],
    ["the film page in Harber", "Harbor", "Harber"],
    // Dictation splits a name, and joins one.
    ["what happened in at las yesterday", "Atlas", "at las"],
    ["where is the vacuumcleaners chat", "Vacuum Cleaners", "vacuumcleaners"],
    ["anything from the vacuum cleaner project", "Vacuum Cleaners", "vacuum cleaner"],
    ["what came of the leger work", "Ledger", "leger"],
  ])("%s", (text, project, words) => {
    expect(heard(text)).toEqual([project, words]);
  });

  it("hears no project in words that are only near one by chance", () => {
    expect(heard("where was that chat about the film detail page")).toBeNull();
    expect(heard("what did we do later that day")).toBeNull();
    expect(heard("did we make it harder to log in")).toBeNull();
  });

  it("prefers the name said exactly to one only near", () => {
    const names = [
      { item: "near", name: "Harbour" },
      { item: "exact", name: "Harbor" },
    ];
    expect(hearName("the Harbor one", names)?.item).toBe("exact");
  });
});
