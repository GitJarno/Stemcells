// Replaces `components/ui/AppBar.tsx`, iOS's bar (`substitutes.cjs`; Android's `.android.tsx`
// stays T3's). In a chat's header (`ChatHeaderContext`) the Cell stands beside its name with what
// it's about under it (`chat/CellTitle.tsx`), git, files and terminal are one Code menu
// (`chat/code.ts`), and the messages scroll under the bar with no band behind it.
import { use } from "react";

import * as Upstream from "../../../components/ui/AppBar";
import { NativeStackScreenOptions } from "../../../native/StackHeader";
import { CellTitle } from "../../chat/CellTitle";
import { codeMenu } from "../../chat/code";
import { ChatHeaderContext } from "../../chat/header";
import { NO_HEADER_BAND } from "../home";

export * from "../../../components/ui/AppBar";

/** The bar's title in a Cell's chat; the bar renders it, so it reads its chat itself. */
function cellTitleOf(threadId: string) {
  return () => <CellTitle threadId={threadId} />;
}

export function AppBar(
  props: Parameters<typeof Upstream.AppBar>[0],
): ReturnType<typeof Upstream.AppBar> {
  const chat = use(ChatHeaderContext);
  if (chat === null || props.embedded || props.sheet) return <Upstream.AppBar {...props} />;
  const code = codeMenu(props.actions ?? [], props.menus ?? []);
  const { threadId, titled } = chat;
  return (
    <>
      <Upstream.AppBar
        {...props}
        subtitle={titled ? null : props.subtitle}
        actions={[]}
        menus={code === null ? [] : [code]}
      />
      <NativeStackScreenOptions
        options={{
          scrollEdgeEffects: NO_HEADER_BAND,
          headerTitle: titled ? cellTitleOf(threadId) : undefined,
        }}
        optionsVersion={[threadId, titled]}
      />
    </>
  );
}
