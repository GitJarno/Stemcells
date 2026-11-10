/** What a reply's card reads of the timeline that draws it (`closeOut/CloseOutCard.tsx`). */
import { use } from "react";

import {
  TimelineRowActivityCtx,
  type TimelineRowActivityState,
} from "../../components/chat/timelineRowContext";

/** The chat's latest run; null before its first, and outside a timeline. */
export function useLatestRunId(): string | null {
  const activity: TimelineRowActivityState | null = use(TimelineRowActivityCtx);
  return activity?.latestRunId ?? null;
}
