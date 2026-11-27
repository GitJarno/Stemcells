// A stage's scroll view tells its stage how far it carries the title (`state.ts`, `headLift`), on
// the UI thread. Apart from `StagePages.tsx`, so every scroll view's marker imports no home views.

import { type Ref, useLayoutEffect, useMemo, useRef } from "react";
import type { ScrollViewInstance } from "react-native";
import { useAnimatedRef, useEvent } from "react-native-reanimated";

import { headLift, type StagePage } from "./state";

function handOn(own: Ref<ScrollViewInstance> | undefined, node: ScrollViewInstance | null) {
  if (typeof own === "function") own(node);
  else if (own) own.current = node;
}

/**
 * A stage's scroll view tells its stage, on the UI thread, how far it carries the title
 * (`headLift`), as Reanimated's own `useScrollOffset` listens. A scroll view mounting into a stage
 * opens at its rest, so it starts there rather than where the one before it stood.
 */
export function useStageScrollView(
  page: StagePage | null,
  own: Ref<ScrollViewInstance> | undefined,
) {
  const lift = page?.lift ?? null;
  const ref = useAnimatedRef();
  const mounted = useRef<number | null>(null);
  const handler = useEvent<{
    contentOffset: { y: number };
    contentInset: { top: number; bottom: number };
    contentSize: { height: number };
    layoutMeasurement: { height: number };
  }>(
    (event) => {
      "worklet";
      lift?.set(
        headLift(
          event.contentOffset.y,
          event.contentInset.top,
          event.contentInset.bottom,
          event.contentSize.height,
          event.layoutMeasurement.height,
        ),
      );
    },
    ["onScroll", "onScrollEndDrag", "onMomentumScrollEnd"],
  ) as unknown as {
    workletEventHandler: {
      registerForEvents: (tag: number) => void;
      unregisterFromEvents: (tag: number) => void;
    };
  };
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Listen to the native scroll view's scroll on the UI thread, as Reanimated's own useScrollOffset does.
  useLayoutEffect(() => {
    if (lift === null) return;
    return ref.observe((tag) => {
      if (typeof tag !== "number") return;
      // A ref handed on again for the same view is no new mount.
      if (tag !== mounted.current) lift.set(0);
      mounted.current = tag;
      handler.workletEventHandler.registerForEvents(tag);
      return () => handler.workletEventHandler.unregisterFromEvents(tag);
    });
  }, [ref, handler, lift]);
  return useMemo(() => {
    if (lift === null) return own;
    return (node: ScrollViewInstance | null) => {
      handOn(own, node);
      ref(node as never);
    };
  }, [own, ref, lift]);
}
