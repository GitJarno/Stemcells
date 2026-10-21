/**
 * What each answer will do, in the card's own words, as the readout line
 * says it: "1 Floof: Remove it first · 2 Bongo: stop, then reply “use
 * staging”" (stemcells/tasks/aski-room.md, decision 8).
 */
import type { Addressee, AnswerPart, Kept, Reading } from "./read";

const KEPT: Record<Exclude<Kept, "unread" | "no-option" | "names">, string> = {
  numbers: "? a Cell can't read option numbers",
  empty: "? say what",
  gone: "is gone",
  list: "? a permission is answered on its own",
  twice: "? answered already",
  questions: "? answer its questions on the card",
};

const UNREAD: Partial<Record<Addressee["kind"], string>> = {
  permission: "? yes or no",
  question: "? which option",
  "sign-in": "? open its chat",
  input: "? open its chat",
};

/** What a reading does to its card. */
export function readingLine(reading: Reading, card: Addressee): string {
  switch (reading.kind) {
    case "option": {
      const { option, words } = reading;
      if (words === null) return option.title;
      const said = `“${words}”`;
      switch (option.choice.kind) {
        case "reply":
          return `reply ${said}`;
        case "stopAndReply":
          return `stop, then reply ${said}`;
        case "nudge":
          return `nudge ${said}`;
        default:
          return `${option.title.replace(/…$/, "")}, with ${said}`;
      }
    }
    case "answer":
      return reading.label;
    case "open":
      return "open its chat";
    case "click":
      return `${reading.option.title} — needs your click`;
    case "words":
      return `${reading.option.title} — say what`;
    case "kept":
      switch (reading.why) {
        case "unread":
          return UNREAD[card.kind] ?? "? not an answer here";
        case "no-option":
          return `? no option ${reading.option ?? ""}`.trim();
        case "names":
          return `? two Cells are called ${card.name ?? card.who}: use the number`;
        default:
          return KEPT[reading.why];
      }
  }
}

/** A part as the readout line says it, one entry per card it names. */
export function partLines(part: AnswerPart, cards: ReadonlyArray<Addressee>): string[] {
  if (part.missing !== null) return [`no card ${part.missing}`];
  return part.targets.flatMap((target) => {
    const card = cards.find((each) => each.number === target.number);
    return card ? [`${card.number} ${card.who}: ${readingLine(target.reading, card)}`] : [];
  });
}
