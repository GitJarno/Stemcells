// A chat's feed in a turn (stemcells/tasks/aski-side.md): the only part of the page that fades.
// It goes out on the turn's clock; the chat arrived at comes in on its own, from when it mounts,
// since a long chat can take longer to lay out than the figures take to come up.

import { useEffect, useState, type ReactNode } from "react";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";

import { PIPE } from "./pipe";
import { arrivesNow, useChatRole, useFeedLeaving } from "./turning";

export function FeedFade(props: { readonly chat: string; readonly children: ReactNode }) {
  const leaving = useFeedLeaving(useChatRole(props.chat));
  const [arrives] = useState(() => arrivesNow(props.chat));
  const shown = useSharedValue(arrives ? 0 : 1);
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- starts the feed's fade on the UI thread once it has mounted
  useEffect(() => {
    if (!arrives) return;
    shown.set(
      withDelay(
        PIPE.settle,
        withTiming(1, { duration: PIPE.feedIn, easing: Easing.out(Easing.cubic) }),
      ),
    );
  }, [arrives, shown]);
  const arriving = useAnimatedStyle(() => ({ opacity: shown.get() }));
  return (
    <Animated.View style={[{ flex: 1 }, arriving]}>
      <Animated.View style={[{ flex: 1 }, leaving]}>{props.children}</Animated.View>
    </Animated.View>
  );
}
