import { describe, expect, it } from "vite-plus/test";

import { modelLexicon } from "./catalog";
import { testCatalog, testPlaces } from "./fixtures/catalog";
import { choiceOf, follow, isDone, type ModelKey, type Taken, type Want } from "./follow";
import { menuFor } from "./menu";
import { roster } from "./places";
import { readWords } from "./read";
import { editsToward, applyEdits, outgoingOf } from "./send";

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
  it("leaves the setup words out", () => {
    const facts = read(
      "Harbor fix the header so it matches the one in Atlas, with Opus 5.5 at max",
    );
    expect(outgoingOf(facts)).toBe("Fix the header so it matches the one in Atlas");
  });

  it("sends a [bracket] word for word", () => {
    expect(
      outgoingOf(read("Fable Cell for Harbor [work on the dismiss animaiton. make it smooth.]")),
    ).toBe("work on the dismiss animaiton. make it smooth.");
  });

  it("sends what was written when no word set anything", () => {
    expect(outgoingOf(read("fix the header"))).toBeNull();
  });

  it("edits the text toward it in place, so chips and formatting keep their words", () => {
    const from = "Harbor fix the ￼ header with Opus 5.5";
    const to = "Fix the ￼ header";
    const edits = editsToward(from, to)!;
    expect(applyEdits(from, edits)).toBe(to);
    expect(edits.every((e) => !from.slice(e.start, e.end).includes("￼"))).toBe(true);
  });

  it("adds a space the tidying put in, and refuses what isn't a reading of the text", () => {
    expect(applyEdits("fix,now", editsToward("fix,now", "fix, now")!)).toBe("fix, now");
    expect(editsToward("fix it", "mend it")).toBeNull();
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
  it("is none when the words start several Cells", () => {
    expect(choiceOf(read("Fix the header in Harbor and the docs in Atlas"))).toBeNull();
  });
});
