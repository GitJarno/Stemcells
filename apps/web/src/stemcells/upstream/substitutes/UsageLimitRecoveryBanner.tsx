// Replaces `components/chat/UsageLimitRecoveryBanner.tsx` (`plugin.ts`): the banner over a Cell
// a usage limit stopped also offers Continue, before upstream's own actions, which carries it on
// now as the composer's "Resume thread" does. With Settings' auto-resume on, a line under it
// says the reset carries the Cell on (`stemcells/limitResume/LimitActions.tsx`).
import type * as Upstream from "../../../components/chat/UsageLimitRecoveryBanner";
import {
  usageLimitRecoveryBannerItem as upstreamBannerItem,
  useUsageLimitRecoveryBannerItem as useUpstreamBannerItem,
} from "../../../components/chat/UsageLimitRecoveryBanner";

import { CarriesOnLine, LimitActions, resetToWaitFor } from "../../limitResume/LimitActions";

export * from "../../../components/chat/UsageLimitRecoveryBanner";

type Props = Parameters<typeof Upstream.usageLimitRecoveryBannerItem>[0];
type Item = ReturnType<typeof Upstream.usageLimitRecoveryBannerItem>;

export const usageLimitRecoveryBannerItem: typeof Upstream.usageLimitRecoveryBannerItem = (
  props,
  resolve,
) => withOurs(upstreamBannerItem(props, resolve), props);

// Upstream's hook calls its own item, past this module: wrap what it returns.
export const useUsageLimitRecoveryBannerItem: typeof Upstream.useUsageLimitRecoveryBannerItem = (
  props,
  resolve,
) => {
  const item = useUpstreamBannerItem(props, resolve);
  return item === null || props === null ? null : withOurs(item, props);
};

function withOurs(item: Item, props: Props): Item {
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
        {/* Upstream's worker and ours pass by a settled Cell and one a request waits on. */}
        {props.settled || props.requestPending ? null : (
          <CarriesOnLine
            cancelled={cancelled}
            reset={resetToWaitFor(props.resetAt, props.stoppedAt)}
          />
        )}
      </>
    ),
  };
}
