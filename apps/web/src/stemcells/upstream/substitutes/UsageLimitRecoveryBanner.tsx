// Replaces `components/chat/UsageLimitRecoveryBanner.tsx` (`plugin.ts`): the banner over a Cell
// a usage limit stopped also offers Continue, before upstream's own actions, which carries it on
// now as the composer's "Resume thread" does. With Settings' auto-resume on, a line under it
// says the reset carries the Cell on (`stemcells/limitResume/LimitActions.tsx`).
import type * as Upstream from "../../../components/chat/UsageLimitRecoveryBanner";
import { usageLimitRecoveryBannerItem as upstreamBannerItem } from "../../../components/chat/UsageLimitRecoveryBanner";

import { CarriesOnLine, LimitActions, resetToWaitFor } from "../../limitResume/LimitActions";

export * from "../../../components/chat/UsageLimitRecoveryBanner";

export const usageLimitRecoveryBannerItem: typeof Upstream.usageLimitRecoveryBannerItem = (
  props,
) => {
  const item = upstreamBannerItem(props);
  // "Cancel auto-resume" on this stop: nothing carries it on by itself.
  const cancelled =
    props.recovery?.runId === props.runId &&
    props.recovery.resetAt === props.resetAt &&
    !props.recovery.autoResume;
  return {
    ...item,
    actions: <LimitActions runId={props.runId} upstream={item.actions} />,
    children: (
      <>
        {item.children}
        <CarriesOnLine
          cancelled={cancelled}
          reset={resetToWaitFor(props.resetAt, props.stoppedAt)}
        />
      </>
    ),
  };
};
