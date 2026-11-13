// A chat's header on the phone (stemcells/tasks/phone-polish.md, decision 8): the Cell beside its
// name, playing what it does, with its project's mark and what its chat is about under it, as its
// card on the home reads (`stemcells/tasks/project-first.md`). Aski's chat has Aski. A chat sent
// from here forms here.

import { use } from "react";
import { Pressable, useWindowDimensions, View } from "react-native";
import { useResolveClassNames } from "uniwind";

import { AskiFigure } from "../aski/AskiFigure";
import { useIsAskiChat } from "../aski/useAskiChat";
import { formingFrom } from "../cell/forming";
import { cellNameOf, clockSeconds, oneLinerOf, poke } from "../cell/kit";
import { ThreadCell } from "../cell/ThreadCell";
import { tellDeed } from "../collection/read";
import { ProjectMark } from "../home/RowCell";
import { needsConnectionOf } from "../line/readings";
import {
  AppText,
  type EnvironmentThreadShell,
  HeaderItemsWidthContext,
  useProject,
  useThreadShellsSelected,
} from "../upstream/cells";
import { useSavedConnection } from "../upstream/push";

/** The Cell's points per cell of its miniature: about the height of the two lines beside it. */
const POINTS = 2;
/** The project's mark beside the one-liner: its capitals' height and a little over. */
const MARK = 14;
/**
 * The bar's buttons and margins, where the bar doesn't say. A custom title keeps its natural
 * width, so it ends under the Code button unless it's told where the buttons start.
 */
const BESIDE_BUTTONS = 152;

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
  const saved = useSavedConnection(thread.environmentId);
  const ink = useResolveClassNames("text-foreground").color;
  const ground = useResolveClassNames("bg-screen").backgroundColor;
  const { width } = useWindowDimensions();
  const buttons = use(HeaderItemsWidthContext) ?? BESIDE_BUTTONS;
  const name = aski ? "Aski" : cellNameOf(thread.id);
  const about = aski
    ? null
    : oneLinerOf(thread.title, project === null ? [name] : [name, project.title]);
  return (
    <View
      accessibilityRole="header"
      accessibilityLabel={about === null ? name : `${name}, ${about}`}
      className="min-w-0 flex-row items-center gap-2.5"
      style={{ maxWidth: Math.max(0, width - buttons) }}
    >
      {aski ? (
        <AskiFigure height={POINTS * 14} ink={ink} ground={ground} />
      ) : (
        // A tap on the Cell is a poke: it answers in the state it is in (`cell/acting.ts`).
        <Pressable
          accessible={false}
          hitSlop={8}
          onPress={() => {
            // Poked until it sees stars is a deed a feat reads, told the first time.
            if (poke(thread.id, clockSeconds())?.key === "act/dazed" && saved !== null)
              tellDeed(thread.environmentId, needsConnectionOf(saved), "dazed", thread.id);
          }}
        >
          <ThreadCell
            thread={thread}
            points={POINTS}
            plays
            formingFrom={formingFrom(thread.id, thread.createdAt)}
          />
        </Pressable>
      )}
      <View className="min-w-0 shrink">
        <AppText className="font-t3-bold text-[15px] text-foreground" numberOfLines={1}>
          {name}
        </AppText>
        {about === null ? null : (
          <View className="min-w-0 flex-row items-center gap-1.5">
            {project === null ? null : <ProjectMark project={project} size={MARK} />}
            <AppText className="min-w-0 shrink text-xs text-foreground" numberOfLines={1}>
              {about}
            </AppText>
          </View>
        )}
      </View>
    </View>
  );
}
