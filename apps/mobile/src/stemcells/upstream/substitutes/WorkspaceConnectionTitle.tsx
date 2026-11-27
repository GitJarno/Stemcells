// Replaces `features/home/WorkspaceConnectionTitle.tsx` (`substitutes.cjs`): the home's title row,
// the app's name and charge or the connection's status in their place, goes up with the list in
// front and fades as it passes the bar, as iOS's large title does (`home/head.ts`). Off the home's
// stages the lift stands at rest.
import type { ComponentProps } from "react";
import Animated from "react-native-reanimated";

import * as Upstream from "../../../features/home/WorkspaceConnectionTitle";
import { useHeadStyle } from "../../home/head";

export * from "../../../features/home/WorkspaceConnectionTitle";

export function WorkspaceConnectionTitle(
  props: ComponentProps<typeof Upstream.WorkspaceConnectionTitle>,
) {
  const lifted = useHeadStyle();
  return (
    <Animated.View
      style={[
        { flexDirection: "row", alignItems: "center" },
        props.grow ? { flex: 1, minWidth: 0 } : { flexShrink: 1 },
        lifted,
      ]}
    >
      <Upstream.WorkspaceConnectionTitle {...props} />
    </Animated.View>
  );
}
