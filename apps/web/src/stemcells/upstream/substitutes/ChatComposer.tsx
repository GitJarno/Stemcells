// Replaces `components/chat/ChatComposer.tsx` (`plugin.ts`): a message
// whose words set up a new Cell is sent without its setup words, and one
// that starts several waits past the most for ⌘↵ (`stemcells/words/send.ts`),
// and their readout stands in the model picker's place
// (`stemcells/words/readoutSlot.ts`). What reads the words hands it both
// through slots, each reader under its turn; upstream's composer and its
// send stay as they are. Only
// Aski's own chat offers Aski's instance (`../cellInstance.ts`).
import { memo, type ReactNode, useRef, useState } from "react";

import {
  ChatComposer as UpstreamChatComposer,
  type ChatComposerProps,
} from "../../../components/chat/ChatComposer";
import { type ShownReadout, WordsReadoutShown, WordsReadoutSlot } from "../../words/readoutSlot";
import { sendSlots, WordsSendSlot } from "../../words/send";
import { useComposerInstances } from "../cellInstance";

export * from "../../../components/chat/ChatComposer";

export const ChatComposer = memo(function ChatComposer(props: ChatComposerProps) {
  const [slots] = useState(sendSlots);
  const instances = useComposerInstances(props);
  // A send waiting for the draft to show what a last word set takes no other.
  const waiting = useRef(false);
  const { onSend } = props;
  const send: ChatComposerProps["onSend"] = (event, dispatchMode, submissionIntent) => {
    if (waiting.current) return;
    const sending = slots.ask(submissionIntent);
    if (sending?.hold) return;
    const go = () => {
      waiting.current = false;
      const settle = sending?.edit() ?? null;
      if (settle === false) return;
      // Upstream's send is async though its type says void: settle when it does.
      const sent: unknown = onSend(
        event,
        dispatchMode,
        sending?.foreground ? "foreground" : submissionIntent,
      );
      settle?.(sent);
    };
    if (sending?.ready) {
      waiting.current = true;
      void sending.ready.then(go);
    } else go();
  };
  return (
    <WordsSendSlot value={slots.register}>
      <ReadoutSlot>
        <UpstreamChatComposer {...props} {...instances} onSend={send} />
      </ReadoutSlot>
    </WordsSendSlot>
  );
});

/** Holds the readout the words show, so a new one renders the picker's place, not the composer. */
function ReadoutSlot(props: { readonly children: ReactNode }) {
  const [readout, setReadout] = useState<ShownReadout | null>(null);
  return (
    <WordsReadoutSlot value={setReadout}>
      <WordsReadoutShown value={readout}>{props.children}</WordsReadoutShown>
    </WordsReadoutSlot>
  );
}
