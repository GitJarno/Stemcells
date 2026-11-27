// What stands over the home's search (the stages' pill, our undo line, the machines' cards) rides
// the keyboard on the UI thread, from the keyboard frames T3's composer rides (`KeyboardStickyView`),
// not from keyboard state, which reaches React only once a keyboard has finished going.
import {
  useGenericKeyboardHandler,
  useReanimatedKeyboardAnimation,
} from "react-native-keyboard-controller";
import { useAnimatedStyle, useDerivedValue, useSharedValue } from "react-native-reanimated";

import { useOverSearch } from "../upstream/home";
import { pillBottom } from "./state";

/** Where the home's foot stands (`useOverSearch`), and a style setting a view's foot `over` the pill's. */
export function useOverKeyboard(over = 0) {
  const place = useOverSearch();
  const { height, progress } = useReanimatedKeyboardAnimation();
  const above = useDerivedValue(() => place.above, [place.above]);
  // The search lets the keyboard go as it starts to close, then rides it down: hold its place.
  const held = useSharedValue<number | null>(null);
  useGenericKeyboardHandler(
    {
      onStart: (event) => {
        "worklet";
        held.value = event.height === 0 ? above.value : null;
      },
    },
    [],
  );
  const style = useAnimatedStyle(
    () => ({
      bottom:
        over + pillBottom(place.rest, held.value ?? above.value, -height.value, progress.value),
    }),
    [place.rest, over],
  );
  return { place, style };
}
