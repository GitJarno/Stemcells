// words.mjs: how many words a person reads in each "shown, not told" reply, as the Cell said
// it in world.mjs. A word is a run of characters between spaces ("(ms)", "10%", "120" count).
//   node words.mjs
import { TURNS } from "./world.mjs";

const count = (text) => (text.match(/\S+/g) ?? []).length;
const turn = (match) => TURNS.find((each) => each.match === match);
const said = (match) =>
  turn(match)
    .steps.filter((step) => step.say !== undefined)
    .map((step) => step.say)
    .join("\n\n");
const fence = (text, kind) =>
  text.match(new RegExp("```" + kind + "\\n([\\s\\S]*?)```"))?.[1] ?? "";
const outside = (text) => text.replace(/```[\s\S]*?```/g, "").trim();
const sum = (parts) => Object.values(parts).reduce((total, each) => total + each, 0);
const line = (name, parts) =>
  console.log(
    `${name}: ${sum(parts)} (${Object.entries(parts)
      .map(([part, words]) => `${part} ${words}`)
      .join(" + ")})`,
  );

line("shown-wall", { "the reply": count(said("How much faster is search now?")) });

{
  const reply = said("How much faster is search now? Show me");
  const [head, columns, , ...rows] = fence(reply, "chart").trim().split("\n");
  const cells = (row) =>
    row
      .split("|")
      .map((cell) => cell.trim())
      .filter(Boolean);
  line("shown-chart", {
    "the sentence": count(outside(reply)),
    "the title": count(head.replace(/^\w+:/, "")),
    "the two series' names": count(cells(columns).slice(1).join(" ")),
    "the row labels": rows.length,
    "the values": rows.flatMap((row) => cells(row).slice(1)).length,
  });
}

{
  const reply = said("How does a search query travel");
  const flow = fence(reply, "mermaid");
  line("shown-diagram", {
    "the sentence": count(outside(reply)),
    "node labels": new Set([...flow.matchAll(/[[({]+([^\])}]+)[\])}]+/g)].map((found) => found[1]))
      .size,
    "edge labels": [...flow.matchAll(/-- (\S+) -->/g)].length,
  });
}

{
  const ask = turn("Ship the search index").steps.find((step) => step.ask !== undefined).ask;
  line("shown-choice", {
    "the header": count(ask.header),
    "the question": count(ask.question),
    "option labels": count(ask.options.map((option) => option.label).join(" ")),
    "option descriptions": count(ask.options.map((option) => option.description).join(" ")),
    "the preview on show (the first option's)": count(ask.options[0].preview),
  });
}

{
  const reply = said("Ship the search index");
  const [lead, card] = reply.split(/\n\n(?=\*\*Done:\*\*)/);
  line("shown-closeout", {
    "the sentence over the card": count(lead),
    "the card's Done line": count(card.split("\n")[0].replace(/\*/g, "")),
    "the card's Left lines": count(
      card
        .split("\n")
        .slice(1)
        .join(" ")
        .replace(/\*|(^|\s)-(?=\s)/g, " "),
    ),
  });
}
