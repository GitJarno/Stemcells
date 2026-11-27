// Follows the app's one dictation while Aski's composer is on screen, so a message knows
// speech put some of it there (`dictated.ts`). Draws nothing.

import { useEffect } from "react";

import { draftTextOf, readDictation, useDictationSession } from "../../upstream/plans";
import { dictationStep, NOT_DICTATING } from "./dictated";

export function DictationMark() {
  const session = useDictationSession();
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- The dictation is a store outside React: each of its steps is read to mark the draft speech wrote into.
  useEffect(() => {
    let watch = NOT_DICTATING;
    const step = () => {
      watch = dictationStep(watch, readDictation(session), draftTextOf);
    };
    step();
    return session.subscribe(step);
  }, [session]);
  return null;
}
