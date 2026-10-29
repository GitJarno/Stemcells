// Replaces `features/threads/ThreadComposer.tsx` (`substitutes.cjs`): the feed fades into the
// ground under the composer (`edge/Scrim.tsx`), so what scrolls past it never reads through
// beside the glass, nor under it by the home indicator. The Cell stands in the header
// (`chat/CellTitle.tsx`), so the room over the composer is upstream's.
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useResolveClassNames } from "uniwind";

import * as Upstream from "../../../features/threads/ThreadComposer";
import { Scrim } from "../../edge/Scrim";

export * from "../../../features/threads/ThreadComposer";

/** Above the composer's box, a short reach, mostly clear, into what stacks on it. */
const OVER = 16;
/** From there, fading in to whole by about the middle of the composer's field. */
const FADE = 48;

export const ThreadComposer: typeof Upstream.ThreadComposer = (props) => {
  const insets = useSafeAreaInsets();
  const ground = useResolveClassNames("bg-screen").backgroundColor;
  return (
    <>
      <Scrim edge="bottom" color={ground} fade={FADE} over={OVER} beyond={insets.bottom} />
      <Upstream.ThreadComposer {...props} />
    </>
  );
};
