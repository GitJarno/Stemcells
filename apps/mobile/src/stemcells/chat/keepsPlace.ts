// A chat kept behind the one in front (`warm.ts`) comes back where the person left it. iOS
// builds a hidden scroll view again when it shows, at the offset it last told React of, which
// can be its top; its feed says where it stood, and is put back there.
import { type Ref, useLayoutEffect, useRef } from "react";
import type { NativeScrollEvent, NativeSyntheticEvent, ScrollViewInstance } from "react-native";

type Scrolled = (event: NativeSyntheticEvent<NativeScrollEvent>) => void;

function handOn(own: Ref<ScrollViewInstance> | undefined, node: ScrollViewInstance | null) {
  if (typeof own === "function") own(node);
  else if (own) own.current = node;
}

/** `ref` and `onScroll` for a chat's scroll view, each handing on to the feed's own. */
export function useKeepsPlace(
  own: Ref<ScrollViewInstance> | undefined,
  scrolled: Scrolled | undefined,
) {
  const view = useRef<ScrollViewInstance | null>(null);
  const place = useRef<number | null>(null);
  const left = useRef<number | null>(null);
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- puts the native scroll view back where it stood, as the chat shows again
  useLayoutEffect(() => {
    if (left.current !== null) view.current?.scrollTo({ y: left.current, animated: false });
    left.current = null;
    return () => {
      left.current = place.current;
    };
  }, []);
  return {
    ref: (node: ScrollViewInstance | null) => {
      view.current = node;
      handOn(own, node);
    },
    onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      // The view built again starts at its top before it is put back: that is no place it was left at.
      if (left.current === null) place.current = event.nativeEvent.contentOffset.y;
      scrolled?.(event);
    },
  };
}
