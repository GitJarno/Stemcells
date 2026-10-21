import { describe, expect, it } from "vite-plus/test";

import { modelLexicon } from "../catalog";
import { heldOf } from "../cells";
import { testCatalog, testPlaces } from "../fixtures/catalog";
import { roster } from "../places";
import { readWords } from "../read";
import { planRecord } from "./history";
import { askOf, floorOf, joined } from "./plan";

const ctx = {
  door: "draft" as const,
  roster: roster(testPlaces),
  models: modelLexicon(testCatalog),
};
const defaults = {
  model: () => "Fable 5.1",
  place: "Kestrel",
  effortLabel: (level: string) => level.slice(0, 1).toUpperCase() + level.slice(1),
};

describe("a plan in the plan history", () => {
  it("keeps the words, the facts, each call, the plan and what came of it", () => {
    const text = "Spawn 2 Opus Cells at max: fix ￼ across Harbor and Atlas";
    const facts = readWords(text, ctx);
    const launch = heldOf(facts)!;
    const ask = askOf(facts, launch, defaults, [{ name: "Harbor", line: "The ferry timetable." }], {
      text,
      chips: ["@src/sign-in.ts"],
    });
    const [harbor, atlas] = ["Harbor", "Atlas"].map((n) => testPlaces.find((p) => p.name === n)!);
    const plan = joined(launch, [
      { title: "Harbor sign-in", prompt: "Fix @src/sign-in.ts in Harbor.", project: harbor! },
      { title: "Atlas sign-in", prompt: "Fix @src/sign-in.ts in Atlas.", project: atlas! },
    ]);
    const record = planRecord({
      ask,
      tries: [{ ms: 4200, came: "answer", answer: { cells: [] } }],
      plan,
      launch,
      defaults,
      risk: [],
      outcome: "started",
    });
    expect(record).toEqual({
      words: "Spawn 2 Opus Cells at max: fix @src/sign-in.ts across Harbor and Atlas",
      cells: ask.cells,
      projects: ["Harbor"],
      tries: [{ ms: 4200, came: "answer", answer: { cells: [] } }],
      plan: {
        kind: "planned",
        cells: [
          {
            model: "Opus 5.5",
            effort: "Max",
            place: "Harbor",
            picked: true,
            title: "Harbor sign-in",
            prompt: "Fix @src/sign-in.ts in Harbor.",
          },
          {
            model: "Opus 5.5",
            effort: "Max",
            place: "Atlas",
            picked: true,
            title: "Atlas sign-in",
            prompt: "Fix @src/sign-in.ts in Atlas.",
          },
        ],
      },
      risk: [],
      outcome: "started",
    });
    const floor = planRecord({
      ask,
      tries: [{ ms: 20000, came: "timeout" }],
      plan: floorOf(launch, facts.task, "Aski took too long to divide this"),
      launch,
      defaults,
      risk: [],
      outcome: "changed",
    });
    expect(floor.plan).toMatchObject({ kind: "floor", why: "Aski took too long to divide this" });
  });
});
