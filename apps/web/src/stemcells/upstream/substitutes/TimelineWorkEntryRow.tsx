// Replaces `components/chat/TimelineWorkEntryRow.tsx` (`plugin.ts`): a turn that failed while its
// machine's disk is full says so, with Free space, where upstream says "Provider error"
// (`disk/DiskFullRow.tsx`). A usage limit, a workspace that failed to prepare (upstream's Retry)
// and every other row stay upstream's.
import { ORCHESTRATION_V2_WORKSPACE_PREPARATION_FAILURE_CODE } from "@t3tools/contracts";
import { type ComponentProps, memo, use } from "react";

import { SimpleWorkEntryRow as UpstreamSimpleWorkEntryRow } from "../../../components/chat/TimelineWorkEntryRow";
import { TimelineRowCtx } from "../../../components/chat/timelineRowContext";
import { DiskFullRow } from "../../disk/DiskFullRow";

export * from "../../../components/chat/TimelineWorkEntryRow";

export const SimpleWorkEntryRow = memo(function SimpleWorkEntryRow(
  props: ComponentProps<typeof UpstreamSimpleWorkEntryRow>,
) {
  const ctx = use(TimelineRowCtx);
  const item = props.workEntry.projectedItem?.item;
  const upstream = <UpstreamSimpleWorkEntryRow {...props} />;
  if (
    item?.type !== "error" ||
    item.status !== "failed" ||
    item.failure.class === "usage_limit" ||
    item.failure.code === ORCHESTRATION_V2_WORKSPACE_PREPARATION_FAILURE_CODE
  ) {
    return upstream;
  }
  return (
    <DiskFullRow
      entryId={props.workEntry.id}
      environmentId={ctx.activeThreadEnvironmentId}
      createdAt={props.workEntry.createdAt}
      timestampFormat={ctx.timestampFormat}
      fallback={upstream}
    />
  );
});
