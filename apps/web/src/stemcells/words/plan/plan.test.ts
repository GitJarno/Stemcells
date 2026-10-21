import { describe, expect, it } from "vite-plus/test";

import { modelLexicon } from "../catalog";
import { heldOf } from "../cells";
import { testCatalog, testPlaces } from "../fixtures/catalog";
import { roster } from "../places";
import { readWords } from "../read";
import {
  askOf,
  floorOf,
  joined,
  needsCheck,
  ownFirst,
  readoutOfPlan,
  shortlistOf,
  startable,
} from "./plan";

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
const projects = [{ name: "Harbor", line: "The ferry timetable." }];

function held(text: string) {
  const facts = readWords(text, ctx);
  return { facts, launch: heldOf(facts)! };
}

describe("a plan", () => {
  it("asks only for the places the words left open", () => {
    const { facts, launch } = held(
      "Spawn 3 Opus Cells: fix sign-in across Harbor, Atlas and Kestrel",
    );
    expect(askOf(facts, launch, defaults, projects).cells).toEqual([
      { model: "Opus 5.5", effort: null, place: null },
      { model: "Opus 5.5", effort: null, place: null },
      { model: "Opus 5.5", effort: null, place: null },
    ]);
  });

  it("reads back each Cell's typed model, effort and place as facts", () => {
    const { facts, launch } = held(
      "spawn 2 Sol in Harbor and an Opus 5.5 at max in Atlas: move sign-in to passkeys, same API on both sides",
    );
    const ask = askOf(facts, launch, defaults, projects);
    expect(ask.cells).toEqual([
      { model: "Sol 6.1", effort: null, place: "Harbor" },
      { model: "Sol 6.1", effort: null, place: "Harbor" },
      { model: "Opus 5.5", effort: "Max", place: "Atlas" },
    ]);
    expect(ask.task).toBe(facts.task);
    expect(ask.projects).toBe(projects);
  });

  it("joins the checked answer to the Cells the words set, and holds when Aski picked a place", () => {
    const { launch } = held("Spawn 3 Opus Cells: fix sign-in across Harbor, Atlas and Kestrel");
    const picked = ["Harbor", "Atlas", "Kestrel"].map((name) =>
      testPlaces.find((place) => place.name === name)!,
    );
    const plan = joined(
      launch,
      picked.map((project) => ({
        title: `Sign-in in ${project.name}`,
        prompt: "Fix sign-in.",
        project,
      })),
    );
    expect(plan.cells.map((cell) => [cell.group, cell.picked])).toEqual(
      launch.cells.map(({ group }, i) => [group, picked[i]]),
    );
    expect(needsCheck(plan)).toBe(true);
  });

  it("keeps the draft where it stands when Aski sent one of its kind there", () => {
    const { launch } = held("Spawn 3 Opus Cells: fix sign-in across Harbor, Atlas and Kestrel");
    const picked = ["Harbor", "Atlas", "Kestrel"].map((name) =>
      testPlaces.find((place) => place.name === name)!,
    );
    const plan = joined(
      launch,
      picked.map((project) => ({ title: project.name, prompt: `Fix ${project.name}.`, project })),
    );
    const mine = ownFirst(plan, "kestrel");
    expect(mine.cells.map((cell) => [cell.picked?.name, cell.prompt])).toEqual([
      ["Kestrel", "Fix Kestrel."],
      ["Atlas", "Fix Atlas."],
      ["Harbor", "Fix Harbor."],
    ]);
    expect(ownFirst(plan, "harbor")).toBe(plan);
    expect(ownFirst(plan, "tidepool")).toBe(plan);
  });

  it("starts at once when the words set every place and Aski only divided the work", () => {
    const { launch } = held(
      "spawn 2 Sol in Harbor and an Opus 5.5 at max in Atlas: move sign-in to passkeys, same API on both sides",
    );
    const plan = joined(
      launch,
      launch.cells.map((_, i) => ({
        title: `Part ${i + 1}`,
        prompt: "Move sign-in.",
        project: null,
      })),
    );
    expect(needsCheck(plan)).toBe(false);
  });

  it("falls to every Cell the words set, each with the whole task, never one Cell", () => {
    const { facts, launch } = held(
      "Spawn 3 Opus Cells: fix sign-in across Harbor, Atlas and Kestrel",
    );
    const floor = floorOf(launch, facts.task, "Aski couldn't divide this.");
    expect(floor.cells.map((cell) => [cell.title, cell.prompt, cell.picked])).toEqual([
      ["Cell 1 of 3", facts.task, null],
      ["Cell 2 of 3", facts.task, null],
      ["Cell 3 of 3", facts.task, null],
    ]);
    expect(needsCheck(floor)).toBe(true);
    // Its places are still open: the words have to say where.
    expect(startable(floor)).toBe(false);
    expect(readoutOfPlan(floor, launch, defaults).plan).toEqual({
      state: "check",
      why: "Aski couldn't divide this.",
      startable: false,
    });
  });

  it("reads back each Cell in the place Aski picked, never the draft's", () => {
    const { launch } = held("Spawn 3 Opus Cells: fix sign-in across Harbor, Atlas and Kestrel");
    const before = readoutOfPlan(floorOf(launch, "", ""), launch, defaults);
    expect(before.groups.map((group) => group.place)).toEqual([null]);
    const picked = ["Harbor", "Atlas", "Kestrel"].map((name) =>
      testPlaces.find((p) => p.name === name)!,
    );
    const plan = joined(
      launch,
      picked.map((project) => ({ title: project.name, prompt: "Fix sign-in.", project })),
    );
    const readout = readoutOfPlan(plan, launch, defaults);
    expect(readout.groups.map((group) => [group.count, group.model?.text, group.place])).toEqual(
      picked.map((project) => [null, "Opus 5.5", { text: project.name, mark: null, aski: true }]),
    );
    expect(readout.plan).toEqual({ state: "check", why: null, startable: true });
  });

  it("shortlists the projects the words mention, then the recent ones, at most twelve", () => {
    const { facts } = held("Spawn 3 Opus Cells: fix sign-in across Harbor, Atlas and Kestrel");
    const recency = (place: { readonly id: string }) =>
      testPlaces.findIndex((p) => p.id === place.id);
    const list = shortlistOf(facts, testPlaces, recency).map((place) => place.name);
    expect(list.slice(0, 3)).toEqual(["Harbor", "Atlas", "Kestrel"]);
    expect(list).toHaveLength(12);
    expect(list[3]).toBe(testPlaces.at(-1)!.name);
    expect(new Set(list).size).toBe(12);
  });
});
