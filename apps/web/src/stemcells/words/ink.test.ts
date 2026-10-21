import { Schema } from "@tiptap/pm/model";
import { EditorState, TextSelection } from "@tiptap/pm/state";
import { describe, expect, it } from "vite-plus/test";

import { modelLexicon } from "./catalog";
import { completionAt } from "./completion";
import { docText, offsetOf, rangeOf } from "./docText";
import { inkOf } from "./ink";
import { roster } from "./places";
import { BLOOM_MS, type WordsSetting, wordsKey, wordsPlugin } from "./plugin";
import { type ReadContext, leadOf, readWords } from "./read";
import { testCatalog, testPlaces } from "./fixtures/catalog";

const ctx: ReadContext = {
  door: "draft",
  roster: roster(testPlaces),
  models: modelLexicon(testCatalog),
};

/** The composer's shape, as far as the reader cares: blocks, text, code, a chip. */
const schema = new Schema({
  nodes: {
    doc: { content: "block+" },
    paragraph: { group: "block", content: "inline*" },
    bulletList: { group: "block", content: "listItem+" },
    listItem: { content: "paragraph block*" },
    code_block: { group: "block", content: "text*", code: true },
    text: { group: "inline" },
    chip: { group: "inline", inline: true, atom: true },
  },
  marks: { code: { code: true } },
});

const p = (...content: Parameters<typeof schema.node>[2][]) =>
  schema.node("paragraph", null, content.flat() as never);
const t = (text: string, code = false) => schema.text(text, code ? [schema.mark("code")] : []);
const doc = (...blocks: ReturnType<typeof p>[]) => schema.node("doc", null, blocks);

/** Each mark as `kind:word`, from a reading of `text`. */
const inked = (text: string, ready = () => true) =>
  inkOf(readWords(text, ctx), ready).map((m) => `${m.kind}:${text.slice(m.start, m.end)}`);

describe("the document as the reader reads it", () => {
  it("is one line per block, with code blank and a chip one character", () => {
    const d = doc(
      p(t("Harbor fix "), t("Atlas", true), t(" now")),
      p(t("see "), schema.node("chip"), t(" too")),
      schema.node("code_block", null, [t("Atlas")]),
    );
    expect(docText(d).text).toBe("Harbor fix       now\nsee ￼ too\n     ");
  });

  it("reads a list as the list it was typed as", () => {
    const item = (text: string) => schema.node("listItem", null, [p(t(text))]);
    const d = doc(
      p(t("2 Harbor:")),
      schema.node("bulletList", null, [item("fix the header"), item("fix the cart")]),
    );
    const text = docText(d);
    expect(text.text).toBe("2 Harbor:\n- fix the header\n- fix the cart");
    expect(readWords(text.text, ctx).share).toBe("items");
    const start = text.text.indexOf("cart");
    expect(
      d.textBetween(
        rangeOf(text, { start, end: start + 4 }).from,
        rangeOf(text, { start, end: start + 4 }).to,
      ),
    ).toBe("cart");
    expect(text.markers.has(text.text.indexOf("- fix"))).toBe(true);
  });

  it("maps a word back to where it sits in the document", () => {
    const d = doc(p(t("fix it")), p(t("in Harbor")));
    const text = docText(d);
    const start = text.text.indexOf("Harbor");
    const { from, to } = rangeOf(text, { start, end: start + 6 });
    expect(d.textBetween(from, to)).toBe("Harbor");
    expect(offsetOf(text, to)).toBe(start + 6);
    expect(offsetOf(text, d.content.size)).toBe(text.text.length);
  });
});

describe("what the composer inks", () => {
  it("inks the words that set something up, and only the winner", () => {
    expect(inked("Harbor fix the header as in the Atlas repo with Opus 5.5 at max")).toEqual([
      "place:Harbor",
      "quiet:Atlas",
      "model:Opus 5.5",
      "effort:max",
    ]);
  });

  it("keeps a count on its model's plate, or on its own when words stand between", () => {
    expect(inked("spawn 2 Sol in Harbor")).toEqual(["model:2 Sol", "place:Harbor"]);
    expect(inked("Sol ×3 in Harbor")).toEqual(["model:Sol ×3", "place:Harbor"]);
    expect(inked("spawn 3 Cells on Sol in Harbor")).toEqual([
      "count:3 Cells",
      "model:Sol",
      "place:Harbor",
    ]);
  });

  it("marks a model whose provider can't start a Cell now", () => {
    const marks = inkOf(readWords("Harbor with Sol", ctx), (id) => id !== "codex");
    expect(marks.find((m) => m.kind === "model")?.warn).toBe(true);
  });

  it("inks nothing that is quoted or code", () => {
    expect(inked('say "Harbor" with `opus`')).toEqual([]);
  });
});

describe("Tab completion at the address", () => {
  const offer = (text: string, recent: Record<string, number> = {}) =>
    completionAt(text, text.length, ctx.roster, leadOf(ctx.models), (r) => recent[r.place.id] ?? 0);

  it("offers the rest of a project's name after three letters", () => {
    expect(offer("Kes")?.rest).toBe("trel");
    expect(offer("Ke")).toBeNull();
  });

  it("offers the most recently used name first, then the shortest", () => {
    expect(offer("Harb")?.place.place.name).toBe("Harbor");
    expect(offer("Harb", { "harbor design": 2 })?.place.place.name).toBe("Harbor Design");
  });

  it("looks past the leads to the address word", () => {
    expect(offer("spawn 2 Opus Tide")?.place.place.name).toBe("Tidepool");
  });

  it("offers nothing past the address, inside a word, or for a whole name", () => {
    expect(offer("fix the Harb")).toBeNull();
    expect(completionAt("Harbxyz", 4, ctx.roster, leadOf(ctx.models), () => 0)).toBeNull();
    expect(offer("Atlas")).toBeNull();
  });
});

describe("the ink plugin", () => {
  let clock = 1_000;
  const setting: WordsSetting = { ctx, ready: () => true, recency: () => 0 };
  const start = (text: string, from: WordsSetting | null = setting) =>
    EditorState.create({
      doc: doc(p(...(text ? [t(text)] : []))),
      plugins: [wordsPlugin(() => from, { now: () => clock })],
    });
  // An inline decoration keeps the attributes it draws on its type.
  const classes = (state: EditorState) =>
    wordsKey
      .getState(state)!
      .decorations.find()
      .map((d) => (d as unknown as { type: { attrs: { class: string } } }).type.attrs.class);
  const type = (state: EditorState, text: string, at = state.selection.from) =>
    state.apply(state.tr.insertText(text, at));

  it("doesn't bloom what was already written when it joins", () => {
    expect(classes(start("Harbor fix it"))).toEqual(["sc-word sc-word-place"]);
  });

  it("blooms a word when it is first read, for a moment", () => {
    let state = start("");
    state = type(state, "Harbor");
    expect(classes(state)).toEqual(["sc-word sc-word-place sc-word-caught"]);
    clock += BLOOM_MS;
    state = type(state, " fix");
    expect(classes(state)).toEqual(["sc-word sc-word-place"]);
  });

  it("keeps a word's bloom when text is typed before it", () => {
    let state = start("fix it in Harbor");
    state = type(state, "now ", 1);
    expect(classes(state)).toEqual(["sc-word sc-word-place"]);
  });

  it("reads nothing where there is no setting", () => {
    expect(classes(start("Harbor fix it", null))).toEqual([]);
  });

  it("offers a completion only while focused", () => {
    let state = start("Kes");
    state = state.apply(state.tr.setSelection(TextSelection.atEnd(state.doc)));
    expect(wordsKey.getState(state)!.offer).toBeNull();
    state = state.apply(state.tr.setMeta(wordsKey, { focused: true }));
    expect(wordsKey.getState(state)!.offer?.rest).toBe("trel");
  });
});
