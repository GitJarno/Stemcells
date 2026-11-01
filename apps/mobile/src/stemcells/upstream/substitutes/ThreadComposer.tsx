// Replaces `features/threads/ThreadComposer.tsx` (`substitutes.cjs`): the feed blurs as it slides
// under the composer (`edge/Veil.ios.tsx`), the composer wears the Flying light while its Cell
// works (`glow/ComposerLight.tsx`), the Cell stands in the header (`chat/CellTitle.tsx`), and a
// Cell's chat on Aski's instance reads as on its driver's own (`../cellInstance.ts`).
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useResolveClassNames } from "uniwind";

import * as Upstream from "../../../features/threads/ThreadComposer";
import { useIsAskiChat } from "../../aski/useAskiChat";
import { Veil } from "../../edge/Veil";
import { ComposerFlight } from "../../glow/ComposerLight";
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
  return (
    <>
      <Veil edge="bottom" color={ground} fade={FADE} over={OVER} beyond={insets.bottom} />
      <ComposerFlight value={{ thread: props.selectedThread, busy: props.activeThreadBusy }}>
        <Upstream.ThreadComposer
          {...props}
          selectedThread={
            modelSelection === thread.modelSelection ? thread : { ...thread, modelSelection }
          }
        />
      </ComposerFlight>
    </>
  );
};
