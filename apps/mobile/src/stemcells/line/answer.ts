// An answer to an ask, the home's and a chat's alike: it takes the ask off at once and waits on
// the undo line before it goes (`held.ts`).

import { type AskActs, whoOf } from "./Ask";
import type { Act } from "./held";
import { held } from "./heldLine";
import { commandsFor, sleptWords } from "./kit";
import type { Ask } from "./line";

/** Choosing and Later for `ask`; `done` runs once an answer is held. */
export function answersFor(ask: Ask, done: () => void): Pick<AskActs, "choose" | "later"> {
  const { need, environmentId } = ask;
  const who = whoOf(need);
  const hold = (commands: Act["commands"], words: string) => {
    if (commands.length === 0) return;
    void held.hold({ key: ask.key, environmentId, threadId: need.threadId, who, words, commands });
    done();
  };
  return {
    choose: (option, given = {}) =>
      hold(
        commandsFor(need, option.choice, given, Date.now()),
        option.choice.kind === "wait" ? sleptWords(who) : `Answered ${who}`,
      ),
    later: () => hold(commandsFor(need, { kind: "later" }, {}, Date.now()), sleptWords(who)),
  };
}
