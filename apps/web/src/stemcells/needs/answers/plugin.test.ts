import { type Node as PmNode, Schema } from "@tiptap/pm/model";
import { EditorState, TextSelection } from "@tiptap/pm/state";
import { describe, expect, it } from "vite-plus/test";

import { cardOf } from "../card";
import { NOW, needFixture, proseFixture, requestFixture } from "../fixtures";
import type { Need } from "../wire";
import { enterOf } from "./enter";
import { answersKey, answersOf, answersPlugin, readDoc } from "./plugin";
import type { Addressee } from "./read";

const addressee = (need: Need, who: string): Addressee => ({
  number: need.number,
  who,
  name: who,
  kind: need.kind,
  cue: need.prose?.cue ?? null,
  card: cardOf(need, NOW),
  gone: false,
  held: false,
});

const CARDS: Addressee[] = [
  addressee(
    needFixture({
      key: "thread-floof:prose:run-1",
      number: 1,
      kind: "prose",
      threadId: "thread-floof",
      prose: proseFixture("question", "Staging, or a fresh local copy?"),
    }),
    "Floof",
  ),
  addressee(needFixture({ number: 3, threadId: "thread-pip", request: requestFixture() }), "Pip"),
  addressee(
    needFixture({
      key: "thread-mochi:request:question-1",
      number: 5,
      kind: "question",
      threadId: "thread-mochi",
      request: requestFixture({
        id: "question-1",
        kind: "user_input",
        prompt: null,
        questions: [
          {
            id: "old-copy",
            header: "Old copy",
            question: "Remove the old copy before the commit, or after?",
            options: [
              { label: "Commit, then remove", description: "", value: null },
              { label: "Remove it first", description: "", value: null },
            ],
            multiSelect: false,
            allowCustomAnswer: true,
          },
        ],
      }),
    }),
    "Mochi",
  ),
];

/** The composer's chips and marks, by upstream's names, as its serializer reads them. */
const schema = new Schema({
  nodes: {
    doc: { content: "block+" },
    paragraph: { group: "block", content: "inline*" },
    text: { group: "inline" },
    hardBreak: { group: "inline", inline: true },
    "composer-mention": {
      group: "inline",
      inline: true,
      atom: true,
      attrs: { path: { default: "" }, source: { default: "" } },
    },
    "composer-skill": {
      group: "inline",
      inline: true,
      atom: true,
      attrs: {
        skillName: { default: "" },
        skillLabel: { default: "" },
        skillDescription: { default: null },
      },
    },
  },
  marks: { code: { code: true } },
});
const doc = (...content: Array<string | PmNode>) =>
  schema.node("doc", null, [
    schema.node(
      "paragraph",
      null,
      content.map((each) => (typeof each === "string" ? schema.text(each) : each)),
    ),
  ]);
const code = (text: string) => schema.text(text, [schema.mark("code")]);
const file = schema.node("composer-mention", { path: "src/App.tsx", source: "@src/App.tsx" });
const skill = schema.node("composer-skill", { skillName: "review", skillLabel: "Review" });

/** What Enter sends each card: a reply's or a note's words, or a custom answer. */
function sent(words: PmNode): string[] {
  const { text, answers } = readDoc(words, CARDS);
  return (enterOf(answers, text.raw)?.answers ?? []).map(({ number, reading }) =>
    reading.kind === "answer"
      ? `${number} ${JSON.stringify(reading.answers)}`
      : `${number} ${reading.words}`,
  );
}

describe("a Cell is sent the words the person wrote, as the composer sends them", () => {
  it("a file chip as its path and a skill as its $name, never as “￼”", () => {
    expect(sent(doc("1 reply look at ", file, " with ", skill, " first"))).toEqual([
      "1 look at @src/App.tsx with $review first",
    ]);
  });

  it("inline code in its backticks, in the middle or at either end", () => {
    expect(sent(doc("1 reply run ", code("pnpm test"), " now"))).toEqual(["1 run `pnpm test` now"]);
    expect(sent(doc("1 reply run ", code("pnpm test")))).toEqual(["1 run `pnpm test`"]);
    expect(sent(doc("1 reply ", code("pnpm test"), " fails"))).toEqual(["1 `pnpm test` fails"]);
  });

  it("a decline's note and a question's own answer the same way", () => {
    expect(sent(doc("3 no, push to ", file, " with ", code("--force-with-lease")))).toEqual([
      "3 push to @src/App.tsx with `--force-with-lease`",
    ]);
    expect(sent(doc("5 answer keep ", file, " as is"))).toEqual([
      `5 ${JSON.stringify({ "old-copy": "keep @src/App.tsx as is" })}`,
    ]);
  });

  it("words in quotes without their quotes, a chip inside as itself", () => {
    expect(sent(doc("for 1 “use ", file, ". Then run it”"))).toEqual([
      "1 use @src/App.tsx. Then run it",
    ]);
  });
});

describe("Tab's ghost", () => {
  it("shows at a caret after a card's number while the composer has the focus", () => {
    const start = EditorState.create({
      doc: doc("5 rem"),
      plugins: [
        answersPlugin(
          () => CARDS,
          () => {},
        ),
      ],
    });
    const atEnd = start.apply(start.tr.setSelection(TextSelection.atEnd(start.doc)));
    const offer = (state: EditorState) => answersOf(state)?.offer?.rest ?? null;
    expect(offer(atEnd)).toBeNull();
    const focused = atEnd.apply(atEnd.tr.setMeta(answersKey, { focused: true }));
    expect(offer(focused)).toBe("ove it first");
    expect(
      offer(focused.apply(focused.tr.setSelection(TextSelection.create(focused.doc, 2)))),
    ).toBeNull();
    expect(offer(focused.apply(focused.tr.setMeta(answersKey, { composing: true })))).toBeNull();
  });
});
