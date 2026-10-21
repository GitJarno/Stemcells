/**
 * Aski's composer is where words answer cards. Aski's pane says so around
 * its chat (`AnswersRoom`): the composer's answers join its editor only
 * there (`AskiAnswers.tsx`), and hand their readout to the model picker's
 * place (`upstream/substitutes/ProviderModelPicker.tsx`).
 */
import { createContext, type ReactNode, useState } from "react";

/** One part of the readout: a card and what Enter does to it. */
export interface ReadoutPart {
  readonly key: string;
  /** The card's number and who it's for; null when no card has the number. */
  readonly number: number | null;
  readonly who: string | null;
  readonly what: string;
  /** "answer" goes on Enter; "click" waits for a click on the card; "kept" stays in the composer. */
  readonly tone: "answer" | "click" | "kept";
}

/** What Enter will do with the words in Aski's composer. */
export interface ShownAnswers {
  readonly parts: ReadonlyArray<ReadoutPart>;
  /** Words besides the answers go to Aski. */
  readonly rest: boolean;
}

/** Aski's composer: how its answers show their readout (null takes it back). */
export const AnswersRoom = createContext<((shown: ShownAnswers | null) => void) | null>(null);

/** The readout to stand in the model picker's place, in Aski's composer. */
export const AnswersShown = createContext<ShownAnswers | null>(null);

/** Marks Aski's chat as the room where words answer cards. */
export function AnswersProvider(props: { readonly children: ReactNode }) {
  const [shown, setShown] = useState<ShownAnswers | null>(null);
  return (
    <AnswersRoom value={setShown}>
      <AnswersShown value={shown}>{props.children}</AnswersShown>
    </AnswersRoom>
  );
}
