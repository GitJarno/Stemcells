// Replaces `features/threads/useThreadHeaderOptions.tsx` (`substitutes.cjs`; Android's `.android.ts`
// stays T3's): a Cell's chat is headed by the Cell beside its name, what its chat is about under it
// (`chat/CellTitle.tsx`); a draft, or a chat the phone doesn't hold yet, keeps upstream's title.
// Every chat's git, files and terminal are one Code button (`chat/code.ts`).
import * as Upstream from "../../../features/threads/useThreadHeaderOptions";
import { CellTitle } from "../../chat/CellTitle";
import { foldIntoCode } from "../../chat/code";
import { useThreadShellsSelected } from "../cells";

export * from "../../../features/threads/useThreadHeaderOptions";

type HeaderItems = ReadonlyArray<Readonly<Record<string, unknown>>>;

/** Upstream hands its header items as a factory (`unstable_headerRightItems`). */
function isItemsFactory(value: unknown): value is () => HeaderItems {
  return typeof value === "function";
}

export function useThreadHeaderOptions(
  props: Parameters<typeof Upstream.useThreadHeaderOptions>[0],
): ReturnType<typeof Upstream.useThreadHeaderOptions> {
  const kept = Upstream.useThreadHeaderOptions(props);
  const threadId = String(props.gitControls.threadId);
  const known = useThreadShellsSelected((threads) => threads.some((one) => one.id === threadId));
  const rightItems = kept.options.unstable_headerRightItems;
  const options = {
    ...kept.options,
    unstable_headerRightItems: isItemsFactory(rightItems)
      ? () => foldIntoCode(rightItems())
      : rightItems,
  };
  if (props.draft === true || !known) return { ...kept, options };
  return {
    ...kept,
    options: {
      ...options,
      headerTitle: () => <CellTitle threadId={threadId} />,
      unstable_headerSubtitle: undefined,
    },
  };
}
