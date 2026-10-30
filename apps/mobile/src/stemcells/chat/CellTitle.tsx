// A chat's header on the phone (stemcells/tasks/phone-polish.md, decision 8): the Cell beside its
// name, playing what it does, with its project's mark and what its chat is about under it, as its
// card on the home reads (`stemcells/tasks/project-first.md`). Aski's chat has Aski. A chat sent
// from here forms here.

import { View } from "react-native";
import { useResolveClassNames } from "uniwind";

import { AskiFigure } from "../aski/AskiFigure";
import { useIsAskiChat } from "../aski/useAskiChat";
import { formingFrom } from "../cell/forming";
import { cellNameOf, oneLinerOf } from "../cell/kit";
import { ThreadCell } from "../cell/ThreadCell";
import { ProjectMark } from "../home/RowCell";
import {
  AppText,
  type EnvironmentThreadShell,
  useProject,
  useThreadShellsSelected,
} from "../upstream/cells";

/** The Cell's points per cell of its miniature: about the height of the two lines beside it. */
const POINTS = 2;
/** The project's mark beside the one-liner: its capitals' height and a little over. */
const MARK = 14;

/** Reads its chat itself: the header keeps the element it was handed until the chat changes. */
export function CellTitle(props: { readonly threadId: string }) {
  const thread = useThreadShellsSelected((threads) =>
    threads.find((one) => one.id === props.threadId),
  );
  return thread === undefined ? null : <Title thread={thread} />;
}

function Title(props: { readonly thread: EnvironmentThreadShell }) {
  const { thread } = props;
  const aski = useIsAskiChat(thread.id);
  const project = useProject({ environmentId: thread.environmentId, projectId: thread.projectId });
  const ink = useResolveClassNames("text-foreground").color;
  const ground = useResolveClassNames("bg-screen").backgroundColor;
  const name = aski ? "Aski" : cellNameOf(thread.id);
  const about = aski
    ? null
    : oneLinerOf(thread.title, project === null ? [name] : [name, project.title]);
  return (
    <View
      accessibilityRole="header"
      accessibilityLabel={about === null ? name : `${name}, ${about}`}
      className="min-w-0 flex-row items-center gap-2.5"
    >
      {aski ? (
        <AskiFigure height={POINTS * 14} ink={ink} ground={ground} />
      ) : (
        <ThreadCell
          thread={thread}
          points={POINTS}
          plays
          formingFrom={formingFrom(thread.id, thread.createdAt)}
        />
      )}
      <View className="min-w-0 shrink">
        <AppText className="font-t3-bold text-[15px] text-foreground" numberOfLines={1}>
          {name}
        </AppText>
        {about === null ? null : (
          <View className="min-w-0 flex-row items-center gap-1.5">
            {project === null ? null : <ProjectMark project={project} size={MARK} />}
            <AppText className="min-w-0 shrink text-xs text-foreground-muted" numberOfLines={1}>
              {about}
            </AppText>
          </View>
        )}
      </View>
    </View>
  );
}
