import { describe, expect, it } from "vite-plus/test";

import { modelLexicon } from "./catalog";
import { launchOf, MOST_CELLS, partOf, readoutOf, withPart } from "./cells";
import { testCatalog, testPlaces } from "./fixtures/catalog";
import { roster } from "./places";
import { readWords } from "./read";

const ctx = {
  door: "draft" as const,
  roster: roster(testPlaces),
  models: modelLexicon(testCatalog),
};
const launch = (text: string) => launchOf(readWords(text, ctx));
const defaults = {
  model: () => "Fable 5.1",
  place: "Kestrel",
  effortLabel: (level: string) => level.slice(0, 1).toUpperCase() + level.slice(1),
};

describe("several Cells from the words alone", () => {
  it("gives each clause its part, said after the message", () => {
    const text = "Fix the header in Harbor and the docs in Atlas";
    const facts = readWords(text, ctx);
    const cells = launchOf(facts)!.cells;
    expect(cells.map((c) => c.group.place?.place.place.name)).toEqual(["Harbor", "Atlas"]);
    expect(cells.map((c) => partOf(facts, c.part))).toEqual(["Fix the header", "The docs"]);
    expect(withPart("Fix the header and the docs", "The docs")).toBe(
      "Fix the header and the docs\n\nYour part: The docs. Others are doing the rest.",
    );
  });

  it("gives each list item its item", () => {
    const facts = readWords("3 Harbor:\n- fix the header\n- fix the footer\n- fix the cart", ctx);
    const cells = launchOf(facts)!.cells;
    expect(cells.map((c) => partOf(facts, c.part))).toEqual([
      "Fix the header",
      "Fix the footer",
      "Fix the cart",
    ]);
  });

  it("names a part with its code as written, in backticks", () => {
    // "cart.ts" is code, which the reader reads as blank.
    const facts = readWords("Fix the header in Harbor and the         file in Atlas", ctx);
    const raw = "Fix the header in Harbor and the cart.ts file in Atlas";
    const code = new Set([33, 34, 35, 36, 37, 38, 39]);
    const part = launchOf(facts)?.cells[1]?.part;
    expect(part && partOf(facts, part, { raw, code })).toBe("The `cart.ts` file");
  });

  it("keeps code the cut before it read past", () => {
    // "and" cuts the clauses, and its spaces took "cart.ts" as blank.
    const facts = readWords("In Harbor update         and in Atlas fix the header", ctx);
    const raw = "In Harbor update cart.ts and in Atlas fix the header";
    const code = new Set([17, 18, 19, 20, 21, 22, 23]);
    const part = launchOf(facts)?.cells[0]?.part;
    expect(part && partOf(facts, part, { raw, code })).toBe("Update `cart.ts`");
  });

  it("keeps code the cut after it read past, its first letter as written", () => {
    const facts = readWords("Fix the header in Harbor and         is wrong in Atlas", ctx);
    const raw = "Fix the header in Harbor and cart.ts is wrong in Atlas";
    const code = new Set([29, 30, 31, 32, 33, 34, 35]);
    const part = launchOf(facts)?.cells[1]?.part;
    expect(part && partOf(facts, part, { raw, code })).toBe("`cart.ts` is wrong");
  });

  it("sends each [bracket] word for word, on its own model", () => {
    const facts = readWords("Fable Cell [fix the modal], another Sol Cell [fix hover]", ctx);
    const cells = launchOf(facts)!.cells;
    expect(
      cells.map((c) => [
        c.group.model?.form.model?.name,
        c.part.kind === "verbatim" ? facts.verbatims[c.part.index]!.text : null,
      ]),
    ).toEqual([
      ["Fable 5.1", "fix the modal"],
      ["Sol 6.1", "fix hover"],
    ]);
  });

  it("waits for Aski when the words don't share the work out", () => {
    expect(launch("2 Sol in Harbor fix the header")).toBeNull();
  });

  it("is none for one Cell", () => {
    expect(launch("Harbor fix the header with Opus 5.5")).toBeNull();
  });
});

describe("the readout", () => {
  const read = (text: string) => readoutOf(launch(text)!, defaults);

  it("reads the words back as one sentence of tokens", () => {
    const readout = read("Sol in Harbor fix the export; Opus 5.5 at max in Atlas update the docs");
    expect(readout.total).toBe(2);
    expect(readout.share).toBe("each its own part");
    expect(
      readout.groups.map((g) => [g.model?.text, g.effort?.text ?? null, g.place?.text]),
    ).toEqual([
      ["Sol 6.1", null, "Harbor"],
      ["Opus 5.5", "Max", "Atlas"],
    ]);
    expect(readout.groups[0]!.model!.mark).toMatchObject({ kind: "model" });
  });

  it("fills a default, dim and with no word behind it", () => {
    const readout = read("Fable Cell [fix the modal], another Cell [fix hover]");
    expect(readout.groups[1]!.model).toEqual({ text: "Fable 5.1", mark: null });
    expect(readout.groups[1]!.place).toEqual({ text: "Kestrel", mark: null });
  });

  it("reads one list's count once", () => {
    const readout = read("3 Harbor:\n- fix the header\n- fix the footer\n- fix the cart");
    expect(readout.groups).toHaveLength(1);
    expect(readout.groups[0]!.count).toMatchObject({ text: "3", mark: { kind: "count" } });
  });

  it("says when the count is past the most", () => {
    const items = Array.from({ length: MOST_CELLS + 2 }, (_, i) => `- fix bug ${i + 1}`).join("\n");
    const readout = read(`${MOST_CELLS + 2} Harbor:\n${items}`);
    expect([readout.total, readout.over]).toEqual([MOST_CELLS + 2, true]);
  });
});
