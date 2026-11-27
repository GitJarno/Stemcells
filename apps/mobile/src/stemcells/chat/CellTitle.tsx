// A chat's header on the phone (stemcells/tasks/phone-polish.md, decision 8): the Cell beside its
// name, playing what it does, with its project's mark and what its chat is about under it, as its
// card on the home reads (`stemcells/tasks/project-first.md`), and its row's symbol while it
// asks. Aski's chat has Aski. A chat sent from here forms here.

import { use, useRef } from "react";
import { Pressable, useWindowDimensions, View } from "react-native";
import { useReducedMotion } from "react-native-reanimated";
import { useResolveClassNames } from "uniwind";

import { AskiFigure } from "../aski/AskiFigure";
import { useIsAskiChat } from "../aski/useAskiChat";
import { formingFrom } from "../cell/forming";
import {
  cellNameOf,
  clockSeconds,
  oneLinerOf,
  poke,
  stroke,
  type Stroking,
  stroking,
} from "../cell/kit";
import { ThreadCell } from "../cell/ThreadCell";
import { tellDeed } from "../collection/read";
import { useColumnWidth } from "./header";
import { askiChatStandsIn } from "../home/copies";
import { CellAskSymbol } from "../line/StatusSymbol";
import { ProjectMark } from "../project/ProjectMark";
import {
  AppText,
  type EnvironmentThreadShell,
  HeaderItemsWidthContext,
  useProject,
  useThreadShellsSelected,
} from "../upstream/cells";
import { machineConnectionOf } from "../upstream/machines";
import { useSavedConnection } from "../upstream/push";

/** The Cell's points per cell of its miniature: about the height of the two lines beside it. */
const POINTS = 2;
/** The project's mark beside the one-liner: as tall as its line. */
const MARK = 16;
/**
 * A soft glow of the ground behind the name's letters: unseen over the plain page, it holds
 * them off whatever scrolls under the bar's blur.
 */
const HALO = { textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 6 } as const;
/**
 * The bar's buttons and margins, where the bar doesn't say. A custom title keeps its natural
 * width, so it ends under the Code button unless it's told where the buttons start.
 */
const BESIDE_BUTTONS = 152;

/** Reads its chat itself: the header keeps the element it was handed until the chat changes. */
export function CellTitle(props: {
  readonly threadId: string;
  /** The chat is on top beside the home: Aski's copies bud off the Aski heading it. */
  readonly besideHome: boolean;
}) {
  const thread = useThreadShellsSelected((threads) =>
    threads.find((one) => one.id === props.threadId),
  );
  // Its column's, beside the home or an inspector; the window's where there's no column.
  const width = useColumnWidth(props.threadId);
  return thread === undefined ? null : (
    <Title thread={thread} width={width} besideHome={props.besideHome} />
  );
}

function Title(props: {
  readonly thread: EnvironmentThreadShell;
  readonly width: number | null;
  readonly besideHome: boolean;
}) {
  const { thread } = props;
  const aski = useIsAskiChat(thread.id);
  const project = useProject({ environmentId: thread.environmentId, projectId: thread.projectId });
  const saved = useSavedConnection(thread.environmentId);
  const ink = useResolveClassNames("text-foreground").color;
  const ground = useResolveClassNames("bg-screen").backgroundColor;
  const { width: windowWidth } = useWindowDimensions();
  const width = props.width ?? windowWidth;
  const buttons = use(HeaderItemsWidthContext) ?? BESIDE_BUTTONS;
  const reduced = useReducedMotion();
  const halo = { ...HALO, textShadowColor: ground };
  /** The finger's travel over the Cell, and whether this touch soothed it: then it is no poke. */
  const hand = useRef<{ travel: Stroking | undefined; soothed: boolean }>({
    travel: undefined,
    soothed: false,
  });
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
        <View ref={props.besideHome ? askiChatStandsIn : undefined}>
          <AskiFigure height={POINTS * 14} ink={ink} ground={ground} />
        </View>
      ) : (
        // A tap on the Cell is a poke: it answers in the state it is in (`cell/acting.ts`).
        <Pressable
          accessible={false}
          hitSlop={8}
          onTouchStart={() => {
            hand.current = { travel: undefined, soothed: false };
          }}
          onTouchMove={(event) => {
            // A finger rubbed back and forth over it: a stroke (`cell/stroke.ts`).
            if (reduced) return;
            const at = clockSeconds();
            const { next, stroked } = stroking(hand.current.travel, event.nativeEvent.pageX, at);
            hand.current.travel = next;
            if (!stroked) return;
            hand.current.soothed = true;
            if (stroke(thread.id, at) !== undefined && saved !== null)
              tellDeed(thread.environmentId, machineConnectionOf(saved), "stroked", thread.id);
          }}
          onPress={() => {
            if (hand.current.soothed) return;
            // Poked until it sees stars is a deed a feat reads, told the first time.
            if (poke(thread.id, clockSeconds())?.key === "act/dazed" && saved !== null)
              tellDeed(thread.environmentId, machineConnectionOf(saved), "dazed", thread.id);
          }}
        >
          <ThreadCell
            thread={thread}
            points={POINTS}
            plays
            stage
            formingFrom={formingFrom(thread.id, thread.createdAt)}
          />
        </Pressable>
      )}
      <View className="min-w-0 shrink">
        <View className="min-w-0 flex-row items-center gap-1.5">
          <AppText
            className="shrink font-t3-bold text-[15px] text-foreground"
            style={halo}
            numberOfLines={1}
          >
            {name}
          </AppText>
          {aski ? null : <CellAskSymbol thread={thread} size={13} />}
        </View>
        {about === null ? null : (
          <View className="min-w-0 flex-row items-center gap-1.5">
            {project === null ? null : <ProjectMark project={project} size={MARK} />}
            <AppText
              className="min-w-0 shrink text-xs text-foreground"
              style={halo}
              numberOfLines={1}
            >
              {about}
            </AppText>
          </View>
        )}
      </View>
    </View>
  );
}
