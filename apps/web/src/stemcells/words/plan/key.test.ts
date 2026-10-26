import { Schema } from "@tiptap/pm/model";
import { describe, expect, it } from "vite-plus/test";

import { docText } from "../docText";
import { planKeyOf } from "./key";

/** The composer's shape, as far as a plan's key cares: text, code, and a chip naming a file. */
const schema = new Schema({
  nodes: {
    doc: { content: "block+" },
    paragraph: { group: "block", content: "inline*" },
    code_block: { group: "block", content: "text*", code: true },
    text: { group: "inline" },
    mention: { group: "inline", inline: true, atom: true, attrs: { path: { default: "" } } },
  },
  marks: { code: { code: true } },
});

const t = (text: string, code = false) => schema.text(text, code ? [schema.mark("code")] : []);
const chip = (path: string) => schema.node("mention", { path });
const doc = (...inline: ReturnType<typeof t>[]) =>
  schema.node("doc", null, [schema.node("paragraph", null, inline)]);
const keyOf = (d: ReturnType<typeof doc>) => planKeyOf(d, docText(d));

// A plan survived edits the reader can't see, and replaced the message
// with one built from older text. Its key sees them.
describe("what a plan was made from", () => {
  it("is the same for the same message", () => {
    const a = doc(t("2 Cells: fix "), chip("src/a.ts"), t(" with "), t("npm test", true));
    const b = doc(t("2 Cells: fix "), chip("src/a.ts"), t(" with "), t("npm test", true));
    expect(keyOf(a)).toBe(keyOf(b));
  });

  it("changes with an edit inside code, which the reader reads as blank", () => {
    const before = doc(t("2 Cells: run "), t("npm test", true));
    const after = doc(t("2 Cells: run "), t("npm lint", true));
    expect(docText(before).text).toBe(docText(after).text);
    expect(keyOf(before)).not.toBe(keyOf(after));
  });

  it("changes when one chip is swapped for another, which the reader reads alike", () => {
    const before = doc(t("2 Cells: fix "), chip("src/a.ts"));
    const after = doc(t("2 Cells: fix "), chip("src/b.ts"));
    expect(docText(before).text).toBe(docText(after).text);
    expect(keyOf(before)).not.toBe(keyOf(after));
  });

  it("changes when the words do", () => {
    expect(keyOf(doc(t("2 Cells: fix the header")))).not.toBe(
      keyOf(doc(t("2 Cells: fix the footer"))),
    );
  });
});
