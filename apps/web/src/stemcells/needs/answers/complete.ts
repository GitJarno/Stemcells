/**
 * Tab completes an option after a card's number (stemcells/tasks/aski-forward.md,
 * Move 2, slice C): "8 " shows what card 8 recommends as a ghost, "3 alw"
 * the rest of the option that starts so, and Tab writes it. A completion is
 * offered only when the reader reads the words back as that same option,
 * so the ghost never writes words that answer something else.
 */
import { LATER } from "../card";
import { type Addressee, type Reading, readAnswers } from "./read";

export interface OptionCompletion {
  /** The rest of the option's title, written at the caret. */
  readonly rest: string;
  /** It still wants the person's words: a space follows it. */
  readonly words: boolean;
}

/** A card's number, maybe after "for", at a clause's start, then what's typed of an option. */
const CLAUSE =
  /(?:^|[,.;:!?\n]\s*|\s(?:and|then)\s+)(?:(?:for|number|card|decision|item)\s+|#)?(\d{1,2})[:,.]?\s+([\p{L}'’ ]*)$/iu;

interface Candidate {
  readonly title: string;
  readonly recommended: boolean;
  /** Whether a reading names this option. */
  readonly is: (reading: Reading) => boolean;
}

function candidatesOf(card: Addressee): Candidate[] {
  const { questions, options } = card.card;
  if (questions.length > 1) return [];
  const question = questions[0];
  const all: Candidate[] =
    question !== undefined
      ? question.options.map((choice) => ({
          title: choice.label,
          recommended: choice.recommended,
          is: (reading) => reading.kind === "answer" && reading.pick === choice.answer,
        }))
      : [...options, ...(card.card.later ? [LATER] : [])].map((option) => ({
          title: option.title.replace(/…$/, ""),
          recommended: option.recommended,
          is: (reading) =>
            (reading.kind === "option" || reading.kind === "click" || reading.kind === "words") &&
            reading.option.id === option.id,
        }));
  return all.toSorted((a, b) => Number(b.recommended) - Number(a.recommended));
}

/**
 * The completion for the caret in `text`, or null. With nothing typed
 * after the number it is the card's recommendation; else the first option,
 * the recommendation first, whose title starts with what's typed.
 */
export function optionCompletionAt(
  text: string,
  caret: number,
  cards: ReadonlyArray<Addressee>,
): OptionCompletion | null {
  if (caret < text.length && !/\s/.test(text[caret]!)) return null;
  const clause = CLAUSE.exec(text.slice(0, caret));
  if (clause === null) return null;
  const card = cards.find((each) => each.number === Number(clause[1]) && !each.gone);
  if (card === undefined || card.held) return null;
  const typed = clause[2]!.toLowerCase();
  // What's typed holds no digits: the last number in the clause is the card's.
  const number = clause.index + clause[0].lastIndexOf(clause[1]!);
  for (const candidate of candidatesOf(card)) {
    const title = candidate.title.toLowerCase();
    if (typed === "" ? !candidate.recommended : !title.startsWith(typed) || title === typed)
      continue;
    const rest = candidate.title.slice(typed.length);
    const part = readAnswers(text.slice(0, caret) + rest + text.slice(caret), cards).parts.find(
      (each) => each.anchor.start <= number && number < each.anchor.end,
    );
    const target = part?.targets.length === 1 ? part.targets[0]! : null;
    if (target?.number === card.number && candidate.is(target.reading))
      return { rest, words: target.reading.kind === "words" };
  }
  return null;
}
