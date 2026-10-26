// The ledge over a Cell's composer, as on the Mac (`apps/web/src/stemcells/composer/
// CellComposerLine.tsx`): the Cell stands on the composer, playing what it's doing, beside
// what its chat is about. The header says who it is; this says on what. A chat just sent
// from the phone shows here first, so its Cell forms here.

import { View } from "react-native";

import { formingFrom } from "../cell/forming";
import { ThreadCell } from "../cell/ThreadCell";
import { cellNameOf, oneLinerOf } from "../cell/kit";
import { AppText, type EnvironmentThreadShell, useProject } from "../upstream/cells";

/** How far the Cell stands in from the composer's edge, clear of its rounded corner. */
const STANDS_IN = 18;
/** How far the ledge reaches down over the composer's top padding, so the Cell's feet meet its edge. */
export const LEDGE_OVERLAP = 6;

export function CellLedge(props: {
  readonly thread: EnvironmentThreadShell;
  readonly contentMaxWidth?: number | undefined;
  readonly onHeightChange: (height: number) => void;
}) {
  const { thread } = props;
  const project = useProject({ environmentId: thread.environmentId, projectId: thread.projectId });
  const line = oneLinerOf(
    thread.title,
    project === null ? [cellNameOf(thread.id)] : [cellNameOf(thread.id), project.title],
  );
  return (
    <View
      pointerEvents="none"
      className="px-[12px]"
      style={{ marginBottom: -LEDGE_OVERLAP }}
      onLayout={(event) => props.onHeightChange(event.nativeEvent.layout.height)}
    >
      <View className="absolute inset-0 bg-linear-to-b from-screen/0 to-screen/60" />
      <View
        className="w-full flex-row items-end self-center"
        style={{ maxWidth: props.contentMaxWidth, paddingLeft: STANDS_IN, gap: 8 }}
      >
        <ThreadCell thread={thread} plays formingFrom={formingFrom(thread.id, thread.createdAt)} />
        {line === null ? null : (
          <AppText
            className="flex-1 text-[13px] text-foreground-muted"
            numberOfLines={1}
            style={{ paddingBottom: LEDGE_OVERLAP + 4 }}
          >
            {line}
          </AppText>
        )}
      </View>
    </View>
  );
}
