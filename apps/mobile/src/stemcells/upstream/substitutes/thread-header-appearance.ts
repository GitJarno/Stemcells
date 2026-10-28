// Replaces `features/threads/thread-header-appearance.ts` (`substitutes.cjs`): a chat's header
// floats over its messages with no band behind it. iOS 27's `automatic` edge draws a hard band
// with a dividing line under a transparent header; the home's list takes the same
// (`NativeScrollViewMarker.tsx`).
import * as Upstream from "../../../features/threads/thread-header-appearance";
import { NO_HEADER_BAND } from "../home";

export * from "../../../features/threads/thread-header-appearance";

export function threadHeaderAppearance(
  usesNativeHeaderGlass: boolean,
): ReturnType<typeof Upstream.threadHeaderAppearance> {
  const kept = Upstream.threadHeaderAppearance(usesNativeHeaderGlass);
  return kept.scrollEdgeEffects ? { ...kept, scrollEdgeEffects: NO_HEADER_BAND } : kept;
}
