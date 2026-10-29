// Replaces `features/threads/ThreadComposer.tsx` (`substitutes.cjs`): the feed blurs as it slides
// under the composer (`edge/Veil.ios.tsx`), so what scrolls past it stops asking for attention
// beside the glass and by the home indicator. The Cell stands in the header
// (`chat/CellTitle.tsx`), so the room over the composer is upstream's.
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useResolveClassNames } from "uniwind";

import * as Upstream from "../../../features/threads/ThreadComposer";
import { Veil } from "../../edge/Veil";

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
      <Upstream.ThreadComposer {...props} />
    </>
  );
};
