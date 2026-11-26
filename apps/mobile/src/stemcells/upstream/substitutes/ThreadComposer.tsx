// Replaces `features/threads/ThreadComposer.tsx` (`substitutes.cjs`): the feed blurs under the
// composer (`edge/Veil.ios.tsx`), which wears the Flying light while its Cell works
// (`glow/ComposerLight.tsx`), reads Aski's instance as the driver's own (`../cellInstance.ts`),
// and has the Cell's ask docked over it, itself answering in words (`line/ChatAsk.tsx`).
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useResolveClassNames } from "uniwind";

import * as Upstream from "../../../features/threads/ThreadComposer";
import { useIsAskiChat } from "../../aski/useAskiChat";
import { Veil } from "../../edge/Veil";
import { ComposerFlight } from "../../glow/ComposerLight";
import { ChatAsk, useChatAsk } from "../../line/ChatAsk";
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
  const docked = useChatAsk(props.isDraft ? null : props.environmentId, thread);
  const composer = (
    <>
      <Veil edge="bottom" color={ground} fade={FADE} over={OVER} beyond={insets.bottom} />
      <ComposerFlight value={{ thread: props.selectedThread, busy: props.activeThreadBusy }}>
        <Upstream.ThreadComposer
          {...props}
          selectedThread={
            modelSelection === thread.modelSelection ? thread : { ...thread, modelSelection }
          }
          // An approval's own words stand: it is upstream's to answer.
          placeholder={
            docked !== null && props.canOperateThread && !props.redirectsApproval
              ? "Or answer in words"
              : props.placeholder
          }
        />
      </ComposerFlight>
    </>
  );
  return (
    <>
      <ChatAsk
        ask={docked}
        environmentId={props.environmentId}
        threadId={thread.id}
        canAnswer={props.canOperateThread}
        contentMaxWidth={props.contentMaxWidth}
      />
      {/* The veil measures the composer alone, as it did before the ask docked over it. */}
      <View>{composer}</View>
    </>
  );
};
