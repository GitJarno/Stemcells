// Aski's button (stemcells/tasks/aski-side.md): a tap swaps the chat in front with Aski through
// it, as down a pipe; held, it offers a fresh Aski, a new Cell, and the next Cell that asks. In the
// Duo's side rail with its upper buttons, under the thumb; over the composer elsewhere. Mounted once
// over the workspace (`Stack.tsx`, `stemcells/seams/mobile.md`).

import * as Haptics from "expo-haptics";
import * as Linking from "expo-linking";
import { AppState, Keyboard, Platform, Pressable, useWindowDimensions, View } from "react-native";
import { Fragment, useEffect, useLayoutEffect, useState } from "react";
import Animated, { Easing, LinearTransition } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FullWindowOverlay } from "react-native-screens";
import { useResolveClassNames } from "uniwind";

import {
  ASKI_FRESH_PATH,
  isShowTool,
  mayShow,
  showOfInput,
  type AskiShow,
} from "../../../../../stemcells/aski/show.ts";
import { placeOf } from "../../../../../stemcells/settings/places.ts";
import { ASKI_BUTTON } from "../../../../../stemcells/words/aski.ts";
import { ThreadCell } from "../cell/ThreadCell";
import { askiStandsIn } from "../home/copies";
import { PHONE_PAGES } from "../chat/placeLinks";
import { askMachine } from "../upstream/machines";
import {
  carryChip,
  GlassSurface,
  Menu,
  Dialog,
  SymbolView,
  useNativeLayoutMetrics,
  useStartNewCell,
  useToolCalls,
} from "../upstream/askiTurn";
import { useThreadShellsSelected, type EnvironmentThreadShell } from "../upstream/cells";
import { useHomeThreadSelection, useShowHome } from "../upstream/home";
import { AskiFigure } from "./AskiFigure";
import {
  answeredSince,
  askStage,
  backTo,
  isAski,
  rememberBack,
  sawAski,
  turnFrom,
  useBack,
  useSeenAt,
  whereOf,
  type Where,
} from "./turn";
import { keyboardShows } from "./keyboard";
import { PIPE } from "./pipe";
import { railStyle, useRail, useRailAski } from "./rail";
import { arrivedAt, beginTurn, keyOf, turning, usePipeStyle, useTurn } from "./turning";
import { useAskiChat } from "./useAskiChat";

/** The button, points across. */
const SIZE = 52;
/** Over the composer's pill (or the home's search field) and its gap. */
const OVER_COMPOSER = 76;
const SIDE = 16;

/** Each show is acted on once, however often its chat's items come round. */
const shown = new Set<string>();

/**
 * Over the workspace: on iOS a layer over the whole window, since the Duo's native columns cover
 * anything laid beside them (the folded Duo had no button). It stays mounted, so a sheet or a
 * modal presented later still comes up over it.
 */
const Above = Platform.OS === "ios" ? FullWindowOverlay : Fragment;

export function AskiButton(props: { readonly pathname: string; readonly routeName?: string }) {
  const here = whereOf(props.routeName, props.pathname);
  const near = useAskiChat(here?.kind === "cell" ? here.environmentId : null);
  const anywhere = useAskiChat(null);
  const aski = near ?? anywhere;
  const keyboardUp = useKeyboardUp();
  return (
    <Above>
      {here === null || aski === null || keyboardUp ? null : <Button here={here} aski={aski} />}
    </Above>
  );
}

function Button(props: { readonly here: Where; readonly aski: EnvironmentThreadShell }) {
  const { here } = props;
  const aski = { environmentId: props.aski.environmentId, threadId: props.aski.id };
  const inAski = isAski(here, aski);
  const back = useBack();
  const seenAt = useSeenAt();
  const openChat = useHomeThreadSelection();
  const showHome = useShowHome();
  const startNewCell = useStartNewCell();
  const ink = useResolveClassNames("text-foreground").color;
  const ground = useResolveClassNames("bg-card").backgroundColor;
  const shells = useThreadShellsSelected((threads) => threads);
  const shellOf = (where: Where | null) =>
    where?.kind === "cell"
      ? (shells.find(
          (thread) => thread.environmentId === where.environmentId && thread.id === where.threadId,
        ) ?? null)
      : null;
  // A string, so the selector's answer is equal from one read to the next.
  const waiting = useThreadShellsSelected((threads) => {
    const asking = threads.filter(
      (thread) => thread.hasPendingApprovals || thread.hasPendingUserInput,
    );
    const first = asking[0];
    return first === undefined ? "" : `${asking.length}\n${first.environmentId}\n${first.id}`;
  });
  const [waitingCount, nextEnvironmentId, nextThreadId] = waiting.split("\n");
  const next =
    nextEnvironmentId === undefined || nextThreadId === undefined
      ? undefined
      : { environmentId: nextEnvironmentId, id: nextThreadId };
  const dot = !inAski && answeredSince(props.aski.latestRun, seenAt);

  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- marks Aski seen in the button's store while its chat stands in front, and as it's left
  useEffect(() => {
    if (!inAski) return;
    sawAski(Date.now());
    return () => sawAski(Date.now());
  }, [inAski]);

  const backShell = shellOf(back);
  // What stands in the button: Aski (null), or what a tap in Aski's chat goes back to. In a turn
  // it goes into the pipe as what it was at the tap, and comes out as what it is by then.
  const playing = useTurn();
  const face = playing?.phase === "dive" ? playing.face : inAski ? (back ?? HOME) : null;
  const faceShell = shellOf(face);
  const onPipe = usePipeStyle(
    playing === null ? "still" : playing.phase === "dive" ? "leaving" : "arriving",
    PIPE.stagger,
  );
  const front = keyOf(here);
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- tells the turn playing that the screen it goes to is in front, which only the route says
  useLayoutEffect(() => arrivedAt(front), [front]);

  const go = (where: Where) => {
    if (where.kind === "home") showHome();
    else openChat({ environmentId: where.environmentId, id: where.threadId });
  };

  const turn = () => {
    if (turning()) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const next = turnFrom(here, aski, backTo());
    const from = shellOf(here);
    if (!inAski && from !== null)
      carryChip(aski, { environmentId: from.environmentId, threadId: from.id, title: from.title });
    const leave = () => {
      rememberBack(next.back);
      go(next.go);
    };
    // Chat to chat, the screen stays: its feed fades, and the chat turns once the figures are in
    // the pipe, so the stall of loading it falls where nothing moves. To or from the home the
    // screens slide at the tap, and only the button's figure goes through.
    const swap = here.kind === "cell" && next.go.kind === "cell";
    beginTurn(
      { from: keyOf(here), to: keyOf(next.go), swap, face },
      {
        dived: () => {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft);
          if (swap) leave();
        },
        out: () => void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium),
      },
    );
    if (!swap) leave();
  };

  const show = (what: AskiShow) => {
    if (what.kind === "cell") {
      const cell = shells.find(
        (thread) => thread.environmentId === what.environmentId && thread.id === what.threadId,
      );
      if (cell === undefined) return;
      rememberBack(null);
      openChat({ environmentId: cell.environmentId, id: cell.id });
    } else if (what.kind === "settings") {
      const place = placeOf(what.place);
      const page = place === null ? undefined : PHONE_PAGES[place.page];
      if (page !== undefined) void Linking.openURL(Linking.createURL(page));
    } else {
      rememberBack(null);
      showHome();
      askStage(what.stage);
    }
  };

  const calls = useToolCalls(inAski ? aski : null);
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- turns this device to what Aski shows, as its call completes in Aski's chat in front
  useEffect(() => {
    for (const call of calls) {
      if (!isShowTool(call.toolName) || call.status !== "completed" || call.completedAt === null)
        continue;
      if (shown.has(call.id)) continue;
      shown.add(call.id);
      const what = showOfInput(call.input, aski.environmentId);
      if (what === null) continue;
      const now = Date.now();
      // On the phone, the app in front is the person at it: it locks in a pocket.
      const active = AppState.currentState === "active";
      const event = { id: call.id, at: call.completedAt, show: what };
      if (mayShow(event, { askiInFront: true, visible: active, lastTouchAt: now, now })) show(what);
    }
  });

  const fresh = async () => {
    const answer = await askMachine(aski.environmentId, ASKI_FRESH_PATH, { method: "POST" }).catch(
      () => null,
    );
    const body = answer?.ok === true ? ((await answer.json()) as { threadId?: unknown }) : null;
    if (typeof body?.threadId !== "string") {
      Dialog.alert(ASKI_BUTTON.freshFailed);
      return;
    }
    rememberBack(inAski ? backTo() : here);
    openChat({ environmentId: aski.environmentId, id: body.threadId });
  };

  const actions = [
    {
      id: "fresh",
      title: ASKI_BUTTON.menu.fresh,
      subtitle: ASKI_BUTTON.menu.freshHint,
      image: "arrow.counterclockwise",
    },
    { id: "cell", title: ASKI_BUTTON.menu.cell, image: "square.and.pencil" },
    ...(next === undefined
      ? []
      : [
          {
            id: "input",
            title: ASKI_BUTTON.menu.input(Number(waitingCount)),
            image: "arrow.turn.down.right",
          },
        ]),
  ];
  const label = inAski
    ? back?.kind === "cell"
      ? ASKI_BUTTON.back(backShell?.title ?? "the Cell")
      : ASKI_BUTTON.backHome
    : ASKI_BUTTON.toAski;

  return (
    <>
      <Place>
        <Menu
          shouldOpenOnLongPress
          actions={actions}
          onPressAction={({ nativeEvent }) => {
            if (nativeEvent.event === "fresh") void fresh();
            else if (nativeEvent.event === "cell") startNewCell();
            else if (nativeEvent.event === "input" && next !== undefined)
              openChat({ environmentId: next.environmentId, id: next.id });
          }}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={dot ? `${label}, ${ASKI_BUTTON.answered}` : label}
            accessibilityHint={inAski ? undefined : ASKI_BUTTON.toAskiHint}
            onPress={turn}
            hitSlop={6}
          >
            <View>
              <GlassSurface
                className="items-center justify-center rounded-full"
                style={{ width: SIZE, height: SIZE }}
              >
                {/* Copies measure this View: on iOS's glass, GlassSurface's ref is Expo's view, which can't measure. */}
                <View
                  ref={inAski ? undefined : askiStandsIn}
                  className="items-center justify-center rounded-full"
                  style={{ width: SIZE, height: SIZE }}
                >
                  <Animated.View className="absolute items-center justify-center" style={onPipe}>
                    {face === null ? (
                      <AskiFigure height={30} ink={ink} ground={ground} />
                    ) : faceShell !== null ? (
                      <ThreadCell thread={faceShell} points={2} />
                    ) : (
                      <SymbolView name="house" size={20} tintColorClassName="accent-foreground" />
                    )}
                  </Animated.View>
                </View>
              </GlassSurface>
              {dot ? (
                <View
                  pointerEvents="none"
                  className="absolute right-0.5 top-0.5 size-3 rounded-full border-2 border-screen bg-foreground"
                />
              ) : null}
            </View>
          </Pressable>
        </Menu>
      </Place>
    </>
  );
}

const HOME: Where = { kind: "home" };

/** Where the button stands: in the side rail over its tabs (under the trophy, on Usage) where the bars run down the side, else over the composer. */
function Place(props: { readonly children: React.ReactNode }) {
  const metrics = useNativeLayoutMetrics();
  const insets = useSafeAreaInsets();
  const window = useWindowDimensions();
  const { ours: told } = useRail();
  useRailAski();
  // Aski is one of ours from its first frame, before the store has heard it.
  const ours = Math.max(told, 1);
  const style = railStyle({ metrics, window, index: ours - 1, ours, size: SIZE }) ?? {
    right: insets.right + SIDE,
    bottom: insets.bottom + OVER_COMPOSER,
  };
  return (
    <Animated.View
      pointerEvents="box-none"
      layout={GLIDE}
      style={{ position: "absolute", ...style }}
    >
      {props.children}
    </Animated.View>
  );
}

/** Between the rail and the composer, as the Duo opens or turns, the button glides to its new place. */
const GLIDE = LinearTransition.duration(240).easing(Easing.out(Easing.cubic));

function useKeyboardUp(): boolean {
  const [up, setUp] = useState(() => keyboardShows(Keyboard.metrics()));
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- follows the system keyboard, which reports only through events
  useEffect(() => {
    const shown = Keyboard.addListener("keyboardWillShow", (event) =>
      setUp(keyboardShows(event.endCoordinates)),
    );
    const hidden = Keyboard.addListener("keyboardWillHide", () => setUp(false));
    return () => {
      shown.remove();
      hidden.remove();
    };
  }, []);
  return up;
}
