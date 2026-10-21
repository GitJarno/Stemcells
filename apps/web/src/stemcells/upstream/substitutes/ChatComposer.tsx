// Replaces `components/chat/ChatComposer.tsx` (`plugin.ts`): a message
// whose words set up a new Cell is sent without its setup words
// (`stemcells/words/send.ts`). The composer's words hand it how, through
// a slot; upstream's composer and its send stay as they are.
import { memo, useRef } from "react";

import {
  ChatComposer as UpstreamChatComposer,
  type ChatComposerProps,
} from "../../../components/chat/ChatComposer";
import { type BeforeSend, WordsSendSlot } from "../../words/send";

export * from "../../../components/chat/ChatComposer";

export const ChatComposer = memo(function ChatComposer(props: ChatComposerProps) {
  const slot = useRef<BeforeSend | null>(null);
  const register = (beforeSend: BeforeSend | null) => {
    slot.current = beforeSend;
  };
  const { onSend } = props;
  const send: ChatComposerProps["onSend"] = (event, dispatchMode, submissionIntent) => {
    const settle = slot.current?.() ?? null;
    // Upstream's send is async though its type says void: settle when it does.
    const sent: unknown = onSend(event, dispatchMode, submissionIntent);
    settle?.(sent);
  };
  return (
    <WordsSendSlot value={register}>
      <UpstreamChatComposer {...props} onSend={send} />
    </WordsSendSlot>
  );
});
