// Replaces `features/threads/useThreadHeaderOptions.tsx` (`substitutes.cjs`; Android's
// `.android.ts` stays T3's): a Cell's chat is headed by the Cell itself beside its name, what
// its chat is about under it (`chat/CellTitle.tsx`). A draft, or a chat the phone doesn't hold
// yet, keeps upstream's title.
import * as Upstream from "../../../features/threads/useThreadHeaderOptions";
import { CellTitle } from "../../chat/CellTitle";
import { useThreadShellsSelected } from "../cells";

export * from "../../../features/threads/useThreadHeaderOptions";

export function useThreadHeaderOptions(
  props: Parameters<typeof Upstream.useThreadHeaderOptions>[0],
): ReturnType<typeof Upstream.useThreadHeaderOptions> {
  const kept = Upstream.useThreadHeaderOptions(props);
  const threadId = String(props.gitControls.threadId);
  const known = useThreadShellsSelected((threads) => threads.some((one) => one.id === threadId));
  if (props.draft === true || !known) return kept;
  return {
    ...kept,
    options: {
      ...kept.options,
      headerTitle: () => <CellTitle threadId={threadId} />,
      unstable_headerSubtitle: undefined,
    },
  };
}
