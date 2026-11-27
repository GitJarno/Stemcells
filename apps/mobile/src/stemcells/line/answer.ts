// An answer to the ask a chat ends on: it takes the ask off and goes at once (`answering.ts`).

import { sendThreadCommand } from "../upstream/needs";
import { type AskActs, whoOf } from "./Ask";
import { type Act, createAnswering } from "./answering";
import { commandsFor } from "./kit";
import type { Ask } from "./line";

export const answering = createAnswering({ send: sendThreadCommand, now: Date.now });

/** Choosing and Later for `ask`. */
export function answersFor(ask: Ask): AskActs {
  const { need, environmentId } = ask;
  const send = (commands: Act["commands"]) =>
    void answering.send({
      key: ask.key,
      environmentId,
      threadId: need.threadId,
      who: whoOf(need),
      commands,
    });
  return {
    choose: (option, given = {}) => send(commandsFor(need, option.choice, given, Date.now())),
    later: () => send(commandsFor(need, { kind: "later" }, {}, Date.now())),
  };
}
