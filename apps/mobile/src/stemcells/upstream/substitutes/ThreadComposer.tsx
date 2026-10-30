// Replaces `features/threads/ThreadComposer.tsx` (`substitutes.cjs`): the feed blurs as it slides
// under the composer (`edge/Veil.ios.tsx`), so what scrolls past it stops asking for attention
// by the glass and the home indicator, and the composer wears the Flying light while its Cell
// works (`glow/ComposerLight.tsx`). The Cell stands in the header (`chat/CellTitle.tsx`).
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useResolveClassNames } from "uniwind";

import * as Upstream from "../../../features/threads/ThreadComposer";
import { Veil } from "../../edge/Veil";
import { ComposerFlight } from "../../glow/ComposerLight";

export * from "../../../features/threads/ThreadComposer";

/** Above the composer's box, a short reach, mostly clear, into what stacks on it. */
const OVER = 24;
/** From there, fading in to whole by about the middle of the composer's field. */
const FADE = 48;

export const ThreadComposer: typeof Upstream.ThreadComposer = (props) => {
  const insets = useSafeAreaInsets();
  const ground = useResolveClassNames("bg-screen").backgroundColor;
  return (
    <>
      <Veil edge="bottom" color={ground} fade={FADE} over={OVER} beyond={insets.bottom} />
      <ComposerFlight value={{ thread: props.selectedThread, busy: props.activeThreadBusy }}>
        <Upstream.ThreadComposer {...props} />
      </ComposerFlight>
    </>
  );
};
