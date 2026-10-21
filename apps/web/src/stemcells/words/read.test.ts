import { describe, expect, it } from "vite-plus/test";

import { clampEffort, modelLexicon } from "./catalog";
import corpus from "./fixtures/corpus.json";
import { testCatalog, testPlaces } from "./fixtures/catalog";
import { jaroWinkler, phoneticKey } from "./phonetic";
import { roster } from "./places";
import { type Door, type Facts, type ReadContext, readWords } from "./read";
import { bracketSpans, literalSpans } from "./text";

const ctx = (door: Door = "draft", extra: Partial<ReadContext> = {}): ReadContext => ({
  door,
  roster: roster(testPlaces),
  models: modelLexicon(testCatalog),
  ...extra,
});

/** Each group as one line: "2 × Sol 6.1 at max in Harbor"; "draft" is the draft's own project, "?" an open place. */
function summary(f: Facts) {
  return {
    groups: f.groups.map((g) => {
      const model = g.model ? (g.model.form.model?.name ?? g.model.form.provider.name) : "default";
      const place = g.place ? g.place.place.place.name : g.open ? "?" : "draft";
      return `${g.count > 1 ? `${g.count} × ` : ""}${model}${g.effort ? ` at ${g.effort.level}` : ""} in ${place}`;
    }),
    share: f.share,
    quiet: f.quiet.map((q) => q.place.place.name),
    verbatims: f.verbatims.length,
    needsPlan: f.needsPlan,
    launch: f.launch,
  };
}

interface Case {
  readonly text: string;
  readonly door?: Door;
  /** Live Cells' names, for Aski's chat. */
  readonly cells?: readonly string[];
  /** Stretches of the text another reader has taken (Aski's card answers). */
  readonly skip?: readonly string[];
  /** The Cell the message speaks to. */
  readonly cell?: string;
  readonly groups: readonly string[];
  readonly share?: string;
  readonly quiet?: readonly string[];
  readonly verbatims?: number;
  readonly needsPlan?: boolean;
  readonly launch?: boolean;
  readonly why: string;
}

describe("readWords over the corpus", () => {
  it.each((corpus as Case[]).map((c) => [c.why, c] as const))("%s", (_why, c) => {
    const skip = (c.skip ?? []).map((s) => {
      const start = c.text.indexOf(s);
      return { start, end: start + s.length };
    });
    const facts = readWords(c.text, ctx(c.door, { skip, cells: c.cells ?? [] }));
    const got = summary(facts);
    expect(facts.cell?.name).toBe(c.cell);
    expect({ text: c.text, groups: got.groups, share: got.share, quiet: got.quiet }).toEqual({
      text: c.text,
      groups: c.groups,
      share: c.share ?? "one",
      quiet: c.quiet ?? [],
    });
    if (c.verbatims !== undefined) expect(got.verbatims).toBe(c.verbatims);
    if (c.needsPlan !== undefined) expect(got.needsPlan).toBe(c.needsPlan);
    if (c.launch !== undefined) expect(got.launch).toBe(c.launch);
  });
});

describe("the Swift reader's near-spelling bug", () => {
  // The Swift resolver could hear "review the" as the Reviews project: the
  // gram "reviewthe" is a near spelling of "reviews". Here a heard name
  // never begins or ends with a cue or a determiner.
  it("never hears 'review the' as Reviews, anywhere in the sentence", () => {
    for (const text of [
      "review the parser",
      "please review the parser",
      "Opus: review the parser",
    ]) {
      const f = readWords(text, ctx());
      expect(f.routing).toEqual([]);
      expect(f.quiet).toEqual([]);
    }
  });
});

describe("what each Cell gets", () => {
  it("gives each clause to its own Cell", () => {
    const text = "Fix the header in Harbor and the docs in Atlas";
    const f = readWords(text, ctx());
    expect(
      f.cells.map((c) =>
        c.part.kind === "clause" ? text.slice(c.part.start, c.part.end).trim() : c.part.kind,
      ),
    ).toEqual(["Fix the header in Harbor", "the docs in Atlas"]);
  });

  it("gives each list item to its own Cell", () => {
    const text = "3 Harbor:\n- fix the header\n- fix the footer\n- fix the cart";
    const f = readWords(text, ctx());
    expect(
      f.cells.map((c) =>
        c.part.kind === "item" ? text.slice(c.part.start, c.part.end) : c.part.kind,
      ),
    ).toEqual(["fix the header", "fix the footer", "fix the cart"]);
  });

  it("keeps a bracket word for word, typos and stops included", () => {
    const f = readWords(
      "Fable Cell for Harbor [work on the dismiss animaiton. make it smooth.]",
      ctx(),
    );
    expect(f.verbatims.map((v) => v.text)).toEqual([
      "work on the dismiss animaiton. make it smooth.",
    ]);
    expect(f.cells[0]?.part).toEqual({ kind: "verbatim", index: 0 });
  });

  it("leaves the setup words out of the task", () => {
    expect(
      readWords(
        "spawn 2 Sol in Harbor and an Opus 5.5 at max in Atlas: move sign-in to passkeys",
        ctx(),
      ).task,
    ).toBe("Move sign-in to passkeys");
    expect(readWords("review the parser with Opus 5.5 at max", ctx()).task).toBe(
      "Review the parser",
    );
  });
});

describe("models from the catalog", () => {
  const lexicon = modelLexicon(testCatalog);
  const read = (word: string) => lexicon.forms.find((f) => f.words.join(" ") === word);

  it("reads a family alone as its newest model", () => {
    expect(read("opus")?.model?.name).toBe("Opus 5.5");
    expect(read("sol")?.model?.name).toBe("Sol 6.1");
  });

  it("reads a provider's word as its default, resolved later", () => {
    expect(read("codex")?.model).toBeNull();
    expect(read("codex")?.provider.id).toBe("codex");
  });

  it("reads the catalog's aliases", () => {
    expect(read("opus-5.5")?.model?.id).toBe("claude-opus-5-5");
  });

  it("knows a model the day it joins the catalog", () => {
    const next = modelLexicon({
      providers: [
        {
          id: "claude",
          name: "Claude",
          models: [
            { id: "claude-opus-6", name: "Opus 6", efforts: [] },
            ...testCatalog.providers[0]!.models,
          ],
        },
      ],
    });
    expect(next.forms.find((f) => f.words.join(" ") === "opus")?.model?.name).toBe("Opus 6");
  });
});

describe("clampEffort", () => {
  it("keeps a level the model has", () => {
    expect(clampEffort("max", ["low", "high", "max"])).toBe("max");
  });
  it("falls to the nearest level, rounding up on a tie", () => {
    expect(clampEffort("max", ["minimal", "low", "medium", "high", "xhigh"])).toBe("xhigh");
    expect(clampEffort("medium", ["low", "high"])).toBe("high");
  });
  it("has nothing to give a model without levels", () => {
    expect(clampEffort("high", [])).toBeNull();
  });
});

describe("phonetics", () => {
  it.each([
    ["atlas", "at less"],
    ["harbor", "harbour"],
    ["brightlane", "bright lane"],
    ["tidepool", "tide pool"],
    ["kestrel", "kess trell"],
  ])("hears %s in %s", (a, b) => {
    expect(phoneticKey(a)).toBe(phoneticKey(b.replace(/ /g, "")));
  });

  it("survives the prefixes its exception table consumes whole", () => {
    // The Swift app crashed on the second keystroke of "wh…".
    for (const w of ["wh", "kn", "gn", "pn", "ae", "wr", "x", "w", "h"])
      expect(() => phoneticKey(w)).not.toThrow();
    expect(phoneticKey("wh")).toBe("W");
  });

  it("keeps unrelated names apart", () => {
    expect(jaroWinkler("atlas", "harbor")).toBeLessThan(0.6);
    expect(jaroWinkler("lantern", "lanterns")).toBeGreaterThan(0.95);
  });
});

describe("literal spans", () => {
  it("finds quotes, code, links, skills, commands and paths", () => {
    const text = 'say "Atlas" or `opus` then [docs](https://example.com) $review /model ~/notes';
    const spans = literalSpans(text).map((s) => text.slice(s.start, s.end));
    expect(spans).toEqual([
      '"Atlas"',
      "`opus`",
      "[docs](https://example.com)",
      "$review",
      "/model",
      "~/notes",
    ]);
  });

  it("counts nesting in brackets and leaves attached or unmatched ones as text", () => {
    const text = "a [b [c] d] items[0] [open";
    expect(bracketSpans(text).map((s) => text.slice(s.start, s.end))).toEqual(["[b [c] d]"]);
  });
});
