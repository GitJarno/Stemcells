import { describe, expect, it } from "vite-plus/test";

import { modelLexicon } from "./catalog";
import { testCatalog, testPlaces } from "./fixtures/catalog";
import { choiceOf, follow, isDone, type ModelKey, type Taken, type Want } from "./follow";
import { menuFor } from "./menu";
import { roster } from "./places";
import { readWords } from "./read";
import { applyEdits, outgoingOf } from "./send";

const ctx = {
  door: "draft" as const,
  roster: roster(testPlaces),
  models: modelLexicon(testCatalog),
};
const read = (text: string) => readWords(text, ctx);

const opus: ModelKey = { instanceId: "claude", model: "claude-opus-5-5", effort: null };
const opusMax: ModelKey = { ...opus, effort: "max" };
const sonnet: ModelKey = { instanceId: "claude", model: "claude-sonnet-5-5", effort: null };
const word = { start: 0, end: 6 };
const none: Taken<string> = { project: null, model: null };
const want = (project: Want["project"], model: Want["model"] = null): Want => ({ project, model });

describe("a word acts once it is done", () => {
  it("waits while the caret is at the end of the word, and acts after a pause", () => {
    expect(isDone("Harbo", { start: 0, end: 5 }, 5, false)).toBe(false);
    expect(isDone("Harbo", { start: 0, end: 5 }, 5, true)).toBe(true);
  });
  it("acts once something else follows, or the caret leaves", () => {
    expect(isDone("Harbor fix", { start: 0, end: 6 }, 6, false)).toBe(true);
    expect(isDone("Harbor", { start: 0, end: 6 }, 2, false)).toBe(true);
    expect(isDone("Opus 5", { start: 0, end: 6 }, 6, false)).toBe(false);
  });
});

describe("the draft follows its words", () => {
  it("moves to the project a word names, and back when the word goes", () => {
    const first = follow(
      none,
      want({ key: "e:harbor", word }),
      { project: "e:atlas", model: null },
      () => "own",
    );
    expect(first.steps).toEqual([{ kind: "move", to: "e:harbor", word }]);
    const back = follow(first.taken, want(null), { project: "e:harbor", model: null }, () => "own");
    expect(back.steps).toEqual([{ kind: "move", to: "e:atlas", word: null }]);
    expect(back.taken.project).toBeNull();
  });

  it("does nothing while a word isn't done", () => {
    const step = follow(
      none,
      want("wait", "wait"),
      { project: "e:atlas", model: null },
      () => "own",
    );
    expect(step.steps).toEqual([]);
  });

  it("writes a project picked from the hero into the word that named the place", () => {
    const taken: Taken<string> = { project: { own: "e:atlas", set: "e:harbor" }, model: null };
    const step = follow(
      taken,
      want({ key: "e:harbor", word }),
      { project: "e:kestrel", model: null },
      () => "own",
    );
    expect(step.steps).toEqual([{ kind: "rewrite-project", word, to: "e:kestrel" }]);
    // And once the word says Kestrel, all is still.
    const after = follow(
      step.taken,
      want({ key: "e:kestrel", word }),
      { project: "e:kestrel", model: null },
      () => "own",
    );
    expect(after.steps).toEqual([]);
  });

  it("sets the model the words name, keeps what was there, and puts it back", () => {
    const first = follow(
      none,
      want(null, { to: opusMax, word }),
      { project: null, model: sonnet },
      () => "sonnet's",
    );
    expect(first.steps).toEqual([{ kind: "model", to: opusMax, word }]);
    expect(first.taken.model?.own).toBe("sonnet's");
    const gone = follow(first.taken, want(null), { project: null, model: opusMax }, () => "x");
    expect(gone.steps).toEqual([{ kind: "restore-model", own: "sonnet's" }]);
  });

  it("writes a model picked from the picker into the words", () => {
    const taken: Taken<string> = { project: null, model: { own: "own", set: opusMax } };
    const picked = { ...sonnet, effort: "high" };
    const step = follow(
      taken,
      want(null, { to: opusMax, word }),
      { project: null, model: picked },
      () => "x",
    );
    expect(step.steps).toEqual([{ kind: "rewrite-model", to: picked }]);
  });

  it("lets a picker set an effort the words don't name", () => {
    const taken: Taken<string> = { project: null, model: { own: "own", set: opus } };
    const step = follow(
      taken,
      want(null, { to: opus, word }),
      { project: null, model: { ...opus, effort: "low" } },
      () => "x",
    );
    expect(step.steps).toEqual([]);
  });
});

describe("what one Cell is sent", () => {
  /** What the Cell gets: null for the text as written, "" for nothing at all. */
  const sent = (text: string, code: ReadonlySet<number> = new Set(), raw = text) => {
    const facts = read(text);
    const out = outgoingOf(facts, facts.cells[0]!.part, { code, markers: new Set() });
    return out === null ? null : out.empty ? "" : applyEdits(raw, out.edits);
  };
  /** Character `from` up to `to`, as a set. */
  const run = (from: number, to: number) =>
    new Set(Array.from({ length: to - from }, (_, k) => from + k));

  it("leaves the setup words out", () => {
    expect(sent("Harbor fix the header so it matches the one in Atlas, with Opus 5.5 at max")).toBe(
      "Fix the header so it matches the one in Atlas",
    );
    expect(sent("fix it in Harbor, now")).toBe("fix it, now");
  });

  it("keeps a project only mentioned", () => {
    expect(sent("Harbor make it match the one in Atlas")).toBe("Make it match the one in Atlas");
  });

  it("keeps quoted words, even ones that would set something up", () => {
    expect(sent('Harbor rename the "Opus 5.5 at max" label')).toBe(
      'Rename the "Opus 5.5 at max" label',
    );
  });

  it("never touches code, which reads as blank", () => {
    // "Harbor fix `Atlas` now": the code reads as blank, and stays as written.
    const raw = "Harbor fix Atlas now";
    const blank = `Harbor fix ${" ".repeat(5)} now`;
    expect(sent(blank, run(11, 16), raw)).toBe("Fix Atlas now");
  });

  it("sends code that is all the setup leaves", () => {
    // "Harbor `cart.ts`": the code is something to send.
    expect(sent(`Harbor ${" ".repeat(7)}`, run(7, 14), "Harbor cart.ts")).toBe("cart.ts");
  });

  it("sends code that is all a [bracket] holds", () => {
    // Its inside reads blank, so it isn't a bracket the reader takes: the
    // text goes without its setup words.
    const blank = `Fable Cell for Harbor [${" ".repeat(7)}]`;
    expect(sent(blank, run(23, 30), "Fable Cell for Harbor [cart.ts]")).toBe("[cart.ts]");
  });

  it('leaves out the "for" that points a Cell at its place', () => {
    expect(sent("Fable Cell for Harbor fix the header")).toBe("Fix the header");
    expect(sent("release notes for Harbor")).toBeNull();
  });

  it("never touches a chip", () => {
    const text = "Harbor fix the ￼ header with Opus 5.5";
    const facts = read(text);
    const out = outgoingOf(facts, facts.cells[0]!.part, { code: new Set(), markers: new Set() })!;
    expect(applyEdits(text, out.edits)).toBe("Fix the ￼ header");
    expect(out.edits.every((e) => !text.slice(e.start, e.end).includes("￼"))).toBe(true);
  });

  it("sends a [bracket] word for word", () => {
    expect(sent("Fable Cell for Harbor [work on the dismiss animaiton. make it smooth.]")).toBe(
      "work on the dismiss animaiton. make it smooth.",
    );
  });

  it("sends what was written when no word set anything", () => {
    expect(sent("fix the header")).toBeNull();
  });

  it("sends nothing when the words were only setup", () => {
    expect(sent("Harbor")).toBe("");
    expect(sent("Harbor with Opus 5.5 at max")).toBe("");
  });
});

describe("a read word's menu", () => {
  const source = (text: string) => ({
    facts: read(text),
    catalog: testCatalog,
    places: ctx.roster.places,
    recency: (p: { place: { id: string } }) =>
      p.place.id === "kestrel" ? 2 : p.place.id === "atlas" ? 1 : 0,
    model: null,
  });

  it("offers the project, the recent ones, and Just a word", () => {
    const entries = menuFor({ kind: "place", start: 0, end: 6 }, source("Harbor fix the header"));
    expect(entries.map((e) => [e.label, e.current ?? false])).toEqual([
      ["Harbor", true],
      ["Kestrel", false],
      ["Atlas", false],
      ["Harbor Design", false],
      ["harbor-redesign", false],
      ["Atlas Performance", false],
      ["Just a word", false],
    ]);
  });

  it("offers the bound model's own efforts", () => {
    const text = "Harbor fix it with Sol at max";
    const entries = menuFor(
      { kind: "effort", start: text.indexOf("max"), end: text.length },
      source(text),
    );
    expect(entries.map((e) => e.label)).toEqual([
      "Minimal",
      "Low",
      "Medium",
      "High",
      "Extra high",
      "Just a word",
    ]);
  });

  it("opens a model's menu on the word's own provider", () => {
    const text = "Harbor fix it with Sol 6";
    const at = text.indexOf("Sol");
    const entries = menuFor({ kind: "model", start: at, end: text.length }, source(text));
    expect(entries.slice(0, 2).map((e) => [e.label, e.current ?? false])).toEqual([
      ["Sol 6.1", false],
      ["Astra 6", false],
    ]);
    expect(entries.find((e) => e.current)?.label).toBe("Sol 6");
  });

  it("offers a mentioned project as a place to start", () => {
    const text = "make it match what Atlas does";
    const at = text.indexOf("Atlas");
    expect(menuFor({ kind: "quiet", start: at, end: at + 5 }, source(text))[0]).toMatchObject({
      label: "Start in Atlas",
      action: { kind: "start-in", placeId: "atlas" },
    });
  });

  it("writes a pick into the words", () => {
    const text = "Harbor fix it";
    const kestrel = menuFor({ kind: "place", start: 0, end: 6 }, source(text)).find(
      (e) => e.label === "Kestrel",
    )!;
    expect(kestrel.action).toEqual({
      kind: "write",
      span: expect.objectContaining({ start: 0, end: 6 }),
      text: "Kestrel",
    });
  });
});

describe("the choice the words make for one Cell", () => {
  it("is the one Cell's place, model and effort", () => {
    const choice = choiceOf(read("Harbor fix it with Opus 5.5 at max"))!;
    expect(choice.place?.place.place.name).toBe("Harbor");
    expect(choice.model?.form.model?.name).toBe("Opus 5.5");
    expect(choice.effort?.level).toBe("max");
  });
  it("is the first Cell's when the words start several alone", () => {
    expect(
      choiceOf(read("Fix the header in Harbor and the docs in Atlas"))?.place?.place.place.name,
    ).toBe("Harbor");
  });
  it("is none when Aski has to plan the Cells", () => {
    expect(choiceOf(read("2 Sol in Harbor fix the header"))).toBeNull();
  });
});
