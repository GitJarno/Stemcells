// Replaces `components/ui/AppBar.tsx`, iOS's bar (`substitutes.cjs`; Android's `.android.tsx`
// stays T3's). In a chat's header (`ChatHeaderContext`) the Cell stands beside its name with what
// it's about under it (`chat/CellTitle.tsx`), git, files and terminal are one Code menu
// (`chat/code.ts`), and the messages scroll under the bar with no band behind it.
import { useIsFocused } from "@react-navigation/native";
import { use, useLayoutEffect } from "react";

import * as Upstream from "../../../components/ui/AppBar";
import {
  useAdaptiveWorkspaceLayout,
  useWorkspacePaneState,
} from "../../../features/layout/adaptive-workspace-context";
import { useNativeColumnLayoutMetrics } from "../../../native/native-layout-metrics";
import { NativeStackScreenOptions } from "../../../native/StackHeader";
import { CellTitle } from "../../chat/CellTitle";
import { codeMenu } from "../../chat/code";
import { ChatHeaderContext, setColumnWidth } from "../../chat/header";
import { NO_HEADER_BAND } from "../home";

export * from "../../../components/ui/AppBar";

/**
 * The bar's title in a Cell's chat; the bar renders it, so it reads its chat itself. The bar
 * stands outside the column, so what only the column knows is handed in.
 */
function cellTitleOf(threadId: string, besideHome: boolean) {
  return () => <CellTitle threadId={threadId} besideHome={besideHome} />;
}

export function AppBar(
  props: Parameters<typeof Upstream.AppBar>[0],
): ReturnType<typeof Upstream.AppBar> {
  const chat = use(ChatHeaderContext);
  if (chat === null || props.embedded || props.sheet) return <Upstream.AppBar {...props} />;
  return <ChatBar {...props} threadId={chat.threadId} titled={chat.titled} />;
}

/** A chat's bar; its own component, so only a chat's bar follows the panes. */
function ChatBar(
  props: Parameters<typeof Upstream.AppBar>[0] & {
    readonly threadId: string;
    readonly titled: boolean;
  },
) {
  const { threadId, titled, ...bar } = props;
  const width = useNativeColumnLayoutMetrics()?.width ?? null;
  const { layout } = useAdaptiveWorkspaceLayout();
  const { panes } = useWorkspacePaneState();
  const onTop = useIsFocused();
  // The home stands in the column beside this one, not floating over it, and no page covers it.
  const besideHome = layout.variant === "expanded" && panes.primarySidebarVisible && onTop;
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Hands the column's width to the title the native bar renders outside the column.
  useLayoutEffect(() => {
    setColumnWidth(threadId, width);
    return () => setColumnWidth(threadId, null);
  }, [threadId, width]);
  const code = codeMenu(bar.actions ?? [], bar.menus ?? []);
  return (
    <>
      <Upstream.AppBar
        {...bar}
        subtitle={titled ? null : bar.subtitle}
        actions={[]}
        menus={code === null ? [] : [code]}
      />
      <NativeStackScreenOptions
        options={{
          scrollEdgeEffects: NO_HEADER_BAND,
          headerTitle: titled ? cellTitleOf(threadId, besideHome) : undefined,
        }}
        optionsVersion={[threadId, titled, besideHome]}
      />
    </>
  );
}
