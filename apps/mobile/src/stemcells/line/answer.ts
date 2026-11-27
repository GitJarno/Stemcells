// An answer to the ask a chat docks: it takes the ask off at once and waits on the undo line
// before it goes (`held.ts`).

import { type AskActs, whoOf } from "./Ask";
import type { Act } from "./held";
import { held } from "./heldLine";
import { commandsFor, sleptWords } from "./kit";
import type { Ask } from "./line";

/** Choosing and Later for `ask`. */
export function answersFor(ask: Ask): AskActs {
  const { need, environmentId } = ask;
  const who = whoOf(need);
  const hold = (commands: Act["commands"], words: string) =>
    void held.hold({ key: ask.key, environmentId, threadId: need.threadId, who, words, commands });
  return {
    choose: (option, given = {}) =>
      hold(
        commandsFor(need, option.choice, given, Date.now()),
        option.choice.kind === "wait" ? sleptWords(who) : `Answered ${who}`,
      ),
    later: () => hold(commandsFor(need, { kind: "later" }, {}, Date.now()), sleptWords(who)),
  };
}
