// Replaces `features/threads/ThreadComposer.tsx` (`substitutes.cjs`): the feed blurs under the
// composer (`edge/Veil.ios.tsx`), which wears the Flying light, reads Aski's instance as the
// driver's own, answers its chat's ask in words, and in Aski's own chat sends through the
// compiler with its plan's tray (`aski/plan/`) and the Cell a turn came from (`aski/carried.ts`).
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useResolveClassNames } from "uniwind";

import * as Upstream from "../../../features/threads/ThreadComposer";
import { carriedTo, carry } from "../../aski/carried";
import { CarriedPill } from "../../aski/CarriedPill";
import { clearDictated } from "../../aski/plan/dictated";
import { DictationMark } from "../../aski/plan/DictationMark";
import { PlanTray } from "../../aski/plan/PlanTray";
import { planDoor } from "../../aski/plan/run";
import { sendThroughPlan } from "../../aski/plan/send";
import { useIsAskiChat } from "../../aski/useAskiChat";
import { Veil } from "../../edge/Veil";
import { ComposerFlight } from "../../glow/ComposerLight";
import { useChatAsk } from "../../line/ChatAsk";
import { attachCell } from "../askiTurn";
import { cellSelection } from "../cellInstance";

export * from "../../../features/threads/ThreadComposer";

/** Above the composer's box, a short reach, mostly clear, into what stacks on it. */
const OVER = 24;
/** From there, fading in to whole by about the middle of the composer's field. */
const FADE = 48;

export const ThreadComposer: typeof Upstream.ThreadComposer = (props) => {
  const insets = useSafeAreaInsets();
  const ground = useResolveClassNames("bg-screen").backgroundColor;
  const thread = props.selectedThread;
  const askis = useIsAskiChat(thread.id);
  const modelSelection = askis
    ? thread.modelSelection
    : cellSelection(props.serverConfig, thread.modelSelection);
  const asked = useChatAsk(
    props.isDraft ? null : props.environmentId,
    thread.id,
    props.activeThreadBusy,
  );
  // Aski's own chat: a message that sets something up is read by the compiler as it goes.
  const plans = askis && !props.isDraft;
  const chat = {
    environmentId: props.environmentId,
    threadId: thread.id,
    draftKey: props.draftKey,
  };
  const onSendMessage: typeof props.onSendMessage = !plans
    ? props.onSendMessage
    : async (followUp, stillSendable) => {
        // Read before the chip joins: the compiler reads the person's words alone.
        const door = planDoor(chat);
        // A message that answers an approval or edits a queued one is that, and no plan.
        const itsOwn = !props.redirectsApproval && !props.queuedEdit;
        const from = itsOwn ? carriedTo(chat) : null;
        const sent = await sendThroughPlan({
          ...door,
          able: door.able && itsOwn,
          send: async () => {
            const detach = from === null ? null : attachCell(door.key, from);
            let went = false;
            try {
              const sent = await props.onSendMessage(followUp, stillSendable);
              went = sent !== null;
              return sent;
            } finally {
              if (!went) detach?.();
              else if (detach !== null) carry(chat, null);
            }
          },
        });
        if (sent !== null) clearDictated(door.key);
        return sent;
      };
  const onChangeDraftMessage: typeof props.onChangeDraftMessage = !plans
    ? props.onChangeDraftMessage
    : (value) => {
        if (value.length === 0) clearDictated(planDoor(chat).key);
        props.onChangeDraftMessage(value);
      };
  return (
    <>
      <Veil edge="bottom" color={ground} fade={FADE} over={OVER} beyond={insets.bottom} />
      {plans ? (
        <>
          <DictationMark />
          <CarriedPill
            environmentId={props.environmentId}
            threadId={thread.id}
            maxWidth={props.contentMaxWidth}
          />
          <PlanTray
            environmentId={props.environmentId}
            threadId={thread.id}
            maxWidth={props.contentMaxWidth}
          />
        </>
      ) : null}
      <ComposerFlight value={{ thread: props.selectedThread, busy: props.activeThreadBusy }}>
        <Upstream.ThreadComposer
          {...props}
          onSendMessage={onSendMessage}
          onChangeDraftMessage={onChangeDraftMessage}
          selectedThread={
            modelSelection === thread.modelSelection ? thread : { ...thread, modelSelection }
          }
          // An approval's own words stand: it is upstream's to answer.
          placeholder={
            asked !== null && props.canOperateThread && !props.redirectsApproval
              ? "Or answer in words"
              : props.placeholder
          }
        />
      </ComposerFlight>
    </>
  );
};
