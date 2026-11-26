// Aski's button (stemcells/tasks/aski-side.md): a tap turns the chat in front over to Aski and
// back; held, it offers a fresh Aski, a new Cell, and the next Cell on Input. It stands in the
// Duo's side rail where the bars run down the side, and over the composer everywhere else.
// Mounted once over the workspace (`Stack.tsx`, `stemcells/seams/mobile.md`).

import * as Haptics from "expo-haptics";
import * as Linking from "expo-linking";
import {
  AppState,
  Keyboard,
  Pressable,
  useWindowDimensions,
  View,
  type ViewInstance,
} from "react-native";
import { useEffect, useRef, useState } from "react";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
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
import { useAskiChat } from "./useAskiChat";

/** The button, points across. */
const SIZE = 52;
/** Over the composer's pill (or the home's search field) and its gap. */
const OVER_COMPOSER = 76;
const SIDE = 16;

/** Each show is acted on once, however often its chat's items come round. */
const shown = new Set<string>();

export function AskiButton(props: { readonly pathname: string; readonly routeName?: string }) {
  const here = whereOf(props.routeName, props.pathname);
  const near = useAskiChat(here?.kind === "cell" ? here.environmentId : null);
  const anywhere = useAskiChat(null);
  const aski = near ?? anywhere;
  const keyboardUp = useKeyboardUp();
  if (here === null || aski === null || keyboardUp) return null;
  return <Button here={here} aski={aski} />;
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
  const reduced = useReducedMotion();
  const ink = useResolveClassNames("text-foreground").color;
  const ground = useResolveClassNames("bg-card").backgroundColor;
  const screen = useResolveClassNames("bg-screen").backgroundColor;
  const pop = useSharedValue(1);
  const standsIn = useRef<ViewInstance>(null);
  const metrics = useNativeLayoutMetrics();
  const window = useWindowDimensions();
  const [wipe, setWipe] = useState<Wipe | null>(null);
  const cover = useSharedValue(0);
  const clear = useSharedValue(1);
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

  const go = (where: Where) => {
    if (where.kind === "home") showHome();
    else openChat({ environmentId: where.environmentId, id: where.threadId });
  };

  const turn = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (!reduced)
      pop.set(
        withSequence(
          withTiming(0.88, { duration: 90, easing: Easing.out(Easing.quad) }),
          withTiming(1, { duration: 220, easing: Easing.out(Easing.back(2)) }),
        ),
      );
    const next = turnFrom(here, aski, backTo());
    const from = shellOf(here);
    if (!inAski && from !== null)
      carryChip(aski, { environmentId: from.environmentId, threadId: from.id, title: from.title });
    rememberBack(next.back);
    const view = standsIn.current;
    if (reduced || view === null) {
      go(next.go);
      return;
    }
    // The chat turns under the ground, which spreads from the button over the pane that changes
    // and clears off the new one.
    view.measureInWindow((x, y, width, height) => {
      const centre = { x: x + width / 2, y: y + height / 2 };
      const left = paneLeft(metrics);
      const reach = Math.hypot(
        Math.max(centre.x - left, window.width - centre.x),
        Math.max(centre.y, window.height - centre.y),
      );
      setWipe({ centre, reach, left });
      cover.set(0);
      clear.set(1);
      cover.set(
        withTiming(1, { duration: SPREAD_MS, easing: Easing.inOut(Easing.cubic) }, (done) => {
          if (!done) return;
          runOnJS(go)(next.go);
          clear.set(
            withDelay(
              HOLD_MS,
              withTiming(0, { duration: CLEAR_MS, easing: Easing.out(Easing.quad) }, (cleared) => {
                if (cleared) runOnJS(setWipe)(null);
              }),
            ),
          );
        }),
      );
    });
  };
  const wipeStyle = useAnimatedStyle(() => ({
    opacity: clear.get(),
    transform: [{ scale: Math.max(cover.get(), 0.001) }],
  }));

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
  const backShell = shellOf(back);
  const label = inAski
    ? back?.kind === "cell"
      ? ASKI_BUTTON.back(backShell?.title ?? "the Cell")
      : ASKI_BUTTON.backHome
    : ASKI_BUTTON.toAski;

  return (
    <>
      {wipe === null ? null : (
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            left: wipe.left,
            right: 0,
            overflow: "hidden",
          }}
        >
          <Animated.View
            style={[
              {
                position: "absolute",
                left: wipe.centre.x - wipe.left - wipe.reach,
                top: wipe.centre.y - wipe.reach,
                width: wipe.reach * 2,
                height: wipe.reach * 2,
                borderRadius: wipe.reach,
                backgroundColor: screen,
              },
              wipeStyle,
            ]}
          />
        </View>
      )}
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
            <Animated.View ref={standsIn} style={{ transform: [{ scale: pop }] }}>
              <GlassSurface
                ref={inAski ? undefined : askiStandsIn}
                className="items-center justify-center rounded-full"
                style={{ width: SIZE, height: SIZE }}
              >
                {inAski ? (
                  backShell !== null ? (
                    <ThreadCell thread={backShell} points={2} />
                  ) : (
                    <SymbolView name="house" size={20} tintColorClassName="accent-foreground" />
                  )
                ) : (
                  <AskiFigure height={30} ink={ink} ground={ground} />
                )}
              </GlassSurface>
              {dot ? (
                <View
                  pointerEvents="none"
                  className="absolute right-0.5 top-0.5 size-3 rounded-full border-2 border-screen bg-foreground"
                />
              ) : null}
            </Animated.View>
          </Pressable>
        </Menu>
      </Place>
    </>
  );
}

interface Wipe {
  readonly centre: { readonly x: number; readonly y: number };
  readonly reach: number;
  readonly left: number;
}
/** The ground spreads, the chat turns under it, a beat, and it clears. */
const SPREAD_MS = 220;
const HOLD_MS = 90;
const CLEAR_MS = 200;

/** Where the pane that turns begins: past the fold where the home stands beside it, else the edge. */
function paneLeft(metrics: ReturnType<typeof useNativeLayoutMetrics>): number {
  if (metrics === null || metrics.verticalBarEdge === "none") return 0;
  const division = metrics.reservedRegions.find(
    (region) => region.kind === "division" && region.height >= metrics.height / 2,
  );
  return division === undefined ? 0 : division.x + division.width;
}

/** Where the button stands: the side rail's open middle where the bars run down the side, else over the composer. */
function Place(props: { readonly children: React.ReactNode }) {
  const metrics = useNativeLayoutMetrics();
  const insets = useSafeAreaInsets();
  const window = useWindowDimensions();
  const edge = metrics?.verticalBarEdge ?? "none";
  const rail =
    edge === "right" ? metrics!.safeArea.right : edge === "left" ? metrics!.safeArea.left : 0;
  const style =
    rail >= SIZE
      ? {
          [edge]: (rail - SIZE) / 2,
          top: (window.height - SIZE) / 2,
        }
      : { right: insets.right + SIDE, bottom: insets.bottom + OVER_COMPOSER };
  return (
    <View pointerEvents="box-none" style={{ position: "absolute", ...style }}>
      {props.children}
    </View>
  );
}

function useKeyboardUp(): boolean {
  const [up, setUp] = useState(Keyboard.isVisible());
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- follows the system keyboard, which reports only through events
  useEffect(() => {
    const shown = Keyboard.addListener("keyboardWillShow", () => setUp(true));
    const hidden = Keyboard.addListener("keyboardWillHide", () => setUp(false));
    return () => {
      shown.remove();
      hidden.remove();
    };
  }, []);
  return up;
}
