// Replaces `components/chat/ChatComposer.tsx` (`plugin.ts`): a message
// whose words set up a new Cell is sent without its setup words, and one
// that starts several waits past the most for ⌘↵ (`stemcells/words/send.ts`).
// The composer's words hand it how, through a slot; upstream's composer and
// its send stay as they are. Only Aski's own chat offers Aski's instance
// (`../cellInstance.ts`).
import { memo, useRef } from "react";

import {
  ChatComposer as UpstreamChatComposer,
  type ChatComposerProps,
} from "../../../components/chat/ChatComposer";
import { type BeforeSend, WordsSendSlot } from "../../words/send";
import { useComposerInstances } from "../cellInstance";

export * from "../../../components/chat/ChatComposer";

export const ChatComposer = memo(function ChatComposer(props: ChatComposerProps) {
  const slot = useRef<BeforeSend | null>(null);
  const instances = useComposerInstances(props);
  // A send waiting for the draft to show what a last word set takes no other.
  const waiting = useRef(false);
  const register = (beforeSend: BeforeSend | null) => {
    slot.current = beforeSend;
  };
  const { onSend } = props;
  const send: ChatComposerProps["onSend"] = (event, dispatchMode, submissionIntent) => {
    if (waiting.current) return;
    const sending = slot.current?.(submissionIntent) ?? null;
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
    <WordsSendSlot value={register}>
      <UpstreamChatComposer {...props} {...instances} onSend={send} />
    </WordsSendSlot>
  );
});
