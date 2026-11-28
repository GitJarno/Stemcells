// Replaces `features/threads/ThreadDetailScreen.tsx` (`substitutes.cjs`): keeps the chats just
// left mounted behind the one in front (`chat/warm.ts`), tells each to its words, its feed's end
// and its pictures' viewer, closes on return to a Cell settled elsewhere, and in Aski's chat puts
// under a message the Cells it found (`recall/recall.ts`) and its plan (`aski/plan/usePlanFeed.ts`).
import { Activity, memo, useEffect, useLayoutEffect, useRef, useState } from "react";
import { View } from "react-native";

import {
  ThreadDetailScreen as UpstreamThreadDetailScreen,
  type ThreadDetailScreenProps,
} from "../../../features/threads/ThreadDetailScreen";
import { usePlanFeed } from "../../aski/plan/usePlanFeed";
import { arrivesNow } from "../../aski/turning";
import { useIsAskiChat } from "../../aski/useAskiChat";
import { ChatGallery } from "../../chat/ChatGallery";
import { ChatInView } from "../../chat/inView";
import { useClosesOnReturn } from "../../chat/useClosesOnReturn";
import { keepWarm, type WarmChat } from "../../chat/warm";
import { AskChatContext } from "../../line/ChatAsk";
import { useRecallFeed } from "../../recall/recall";

export * from "../../../features/threads/ThreadDetailScreen";

/** A chat reading its messages again has less to show than when it last had them. */
const behind = (props: ThreadDetailScreenProps, held: ThreadDetailScreenProps) =>
  props.contentPresentation.kind === "loading" && held.contentPresentation.kind === "ready";

/** The props each kept chat was last drawn with: its handler props call these, whenever they are called. */
const drawn = new Map<string, ThreadDetailScreenProps>();
const latest = (key: string) => drawn.get(key);

// A chat behind is hidden, so its effects stop: it marks nothing read and sounds nothing. iOS
// takes a hidden view's native views down, so it also costs no memory but its React tree's.
export function ThreadDetailScreen(props: ThreadDetailScreenProps) {
  const key = `${props.environmentId}:${props.selectedThread.id}`;
  const [warm, setWarm] = useState<ReadonlyArray<WarmChat<ThreadDetailScreenProps>>>([]);
  const chats = keepWarm(warm, {
    key,
    props,
    latest,
    passing: props.draftMode !== undefined,
    fresh: arrivesNow(props.selectedThread.id),
    behind,
  });
  if (chats !== warm) setWarm(chats);
  const mine = useRef(new Set<string>());
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- holds the props each kept chat was last drawn with, which its unchanging handler props call
  useLayoutEffect(() => {
    drawn.set(key, props);
    mine.current.add(key);
    // Only the chats this screen let go of: another screen in the stack keeps its own.
    for (const held of mine.current) {
      if (chats.some((chat) => chat.key === held)) continue;
      drawn.delete(held);
      mine.current.delete(held);
    }
  });
  // The chat just left hides a frame after the one in front shows: hiding takes its native views
  // down, and showing builds the other's, so one commit doing both holds the frame twice as long.
  const [shown, setShown] = useState(key);
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- hides the chat just left once the one in front has painted
  useEffect(() => {
    if (shown === key) return;
    const frame = requestAnimationFrame(() => setShown(key));
    return () => cancelAnimationFrame(frame);
  }, [shown, key]);
  return (
    <>
      {chats.map((chat) => (
        <Activity
          key={`${chat.key}#${chat.born}`}
          mode={chat.key === key || chat.key === shown ? "visible" : "hidden"}
        >
          <View
            style={chat.key === key ? FRONT : BEHIND}
            pointerEvents={chat.key === key ? "auto" : "none"}
          >
            <Chat {...chat.props} />
          </View>
        </Activity>
      ))}
    </>
  );
}

const FRONT = { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 1 } as const;
// Unseen for the frame it outlives the turn by: two chats never show through each other.
const BEHIND = { ...FRONT, zIndex: 0, opacity: 0 } as const;

const Chat = memo(function Chat(props: ThreadDetailScreenProps) {
  const chat = {
    environmentId: props.selectedThread.environmentId,
    threadId: props.selectedThread.id,
  };
  useClosesOnReturn(chat);
  const aski = useIsAskiChat(chat.threadId);
  const feed = usePlanFeed(
    useRecallFeed(props.selectedThreadFeed, chat.environmentId, aski),
    chat.environmentId,
    chat.threadId,
    aski,
  );
  return (
    <ChatInView value={chat}>
      <ChatGallery
        feed={props.selectedThreadFeed}
        place={{
          environmentId: props.environmentId,
          threadId: props.selectedThread.id,
          workspaceRoot: props.threadCwd,
        }}
      >
        <AskChatContext value={{ ...chat, canAnswer: props.canOperateThread }}>
          <UpstreamThreadDetailScreen {...props} selectedThreadFeed={feed} />
        </AskChatContext>
      </ChatGallery>
    </ChatInView>
  );
});
