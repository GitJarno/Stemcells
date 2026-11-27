// Replaces `features/threads/ThreadComposer.tsx` (`substitutes.cjs`): the feed blurs under the
// composer (`edge/Veil.ios.tsx`), which wears the Flying light while its Cell works
// (`glow/ComposerLight.tsx`), reads Aski's instance as the driver's own (`../cellInstance.ts`),
// and answers in words the ask its chat ends on (`line/ChatAsk.tsx`).
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useResolveClassNames } from "uniwind";

import * as Upstream from "../../../features/threads/ThreadComposer";
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
  return (
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
            asked !== null && props.canOperateThread && !props.redirectsApproval
              ? "Or answer in words"
              : props.placeholder
          }
        />
      </ComposerFlight>
    </>
  );
};
