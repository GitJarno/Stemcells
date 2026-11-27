// Replaces `features/threads/ThreadComposer.tsx` (`substitutes.cjs`): the feed blurs under the
// composer (`edge/Veil.ios.tsx`), which wears the Flying light (`glow/ComposerLight.tsx`), reads
// Aski's instance as the driver's own, answers its chat's ask in words (`line/ChatAsk.tsx`), and
// in Aski's own chat sends through the compiler and carries its plan's tray (`aski/plan/`).
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useResolveClassNames } from "uniwind";

import * as Upstream from "../../../features/threads/ThreadComposer";
import { clearDictated } from "../../aski/plan/dictated";
import { DictationMark } from "../../aski/plan/DictationMark";
import { PlanTray } from "../../aski/plan/PlanTray";
import { planDoor } from "../../aski/plan/run";
import { sendThroughPlan } from "../../aski/plan/send";
import { useIsAskiChat } from "../../aski/useAskiChat";
import { Veil } from "../../edge/Veil";
import { ComposerFlight } from "../../glow/ComposerLight";
import { useChatAsk } from "../../line/ChatAsk";
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
        const door = planDoor(chat);
        const sent = await sendThroughPlan({
          ...door,
          // A message that answers an approval or edits a queued one is that, and no plan.
          able: door.able && !props.redirectsApproval && !props.queuedEdit,
          send: () => props.onSendMessage(followUp, stillSendable),
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
