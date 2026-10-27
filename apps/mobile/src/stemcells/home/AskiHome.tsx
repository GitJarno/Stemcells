// Aski greeting you over the home's tabs. A tap on Aski opens its chat; a tap on its line
// rolls another (`greeting.ts`). Its eyes are `^ ^` once every Cell has landed and none works
// or waits on you, and while its copies fly to forming Cells (`copies.ts`). On the tab of
// Cells put away (Settled, or Asleep) the night comes over it.

import { use, useState } from "react";
import { Pressable, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useResolveClassNames } from "uniwind";

import { AskiFigure } from "../aski/AskiFigure";
import { EYE_LINE, VIEW } from "../aski/drawing";
import { useAskiChat } from "../aski/useAskiChat";
import { AppText } from "../upstream/cells";
import {
  NativePrimaryColumnContext,
  SegmentedControl,
  useHomeThreadSelection,
} from "../upstream/home";
import { segmentsStandIn } from "../line/Hops";
import { askiStandsIn, useCopies } from "./copies";
import { greetingAt } from "./greeting";
import { Night } from "./Night";
import { NIGHT_INK, NIGHT_TEXT, skyAt } from "./sky";
import { HomeTabsContext } from "./state";

/** Aski's height, points, and the room over it. */
const ASKI_HEIGHT = 92;
const ROOM_OVER = 14;
/** How far the night reaches over the header: the status bar, and a pull past the top. */
const NIGHT_ABOVE = 600;

/** Where a line starts: it moves on each hour, so the home doesn't always open on the same one. */
const seedNow = () => Math.floor(Date.now() / 3_600_000);

export function AskiHome() {
  const home = use(HomeTabsContext);
  const primaryColumn = use(NativePrimaryColumnContext);
  const insets = useSafeAreaInsets();
  const aski = useAskiChat(home?.environmentId ?? null);
  const openChat = useHomeThreadSelection();
  const [rolls, setRolls] = useState(0);
  const [seed] = useState(seedNow);
  const [height, setHeight] = useState(0);
  const copies = useCopies();
  const ink = useResolveClassNames("text-foreground").color;
  const screen = useResolveClassNames(primaryColumn ? "bg-drawer" : "bg-screen").backgroundColor;
  if (home === null) return null;
  const { counts, night } = home;
  const eyesAt = ROOM_OVER + ((EYE_LINE - VIEW.y) / VIEW.height) * ASKI_HEIGHT;
  const ground = night ? skyAt(height > 0 ? eyesAt / height : 0) : screen;
  const line = greetingAt(counts, rolls, seed);
  // While its copies fly, and once every Cell has landed with none waiting.
  const pleased =
    copies.length > 0 || (counts.input === 0 && counts.working === 0 && counts.active > 0);
  return (
    <View
      className="items-center pb-4"
      style={{ paddingTop: ROOM_OVER }}
      onLayout={({ nativeEvent }) => setHeight(nativeEvent.layout.height)}
    >
      {night ? <Night above={NIGHT_ABOVE + insets.top} screen={screen} /> : null}
      <Pressable
        ref={askiStandsIn}
        accessibilityRole="button"
        accessibilityLabel="Aski"
        accessibilityHint="Opens Aski's chat"
        disabled={aski === null}
        onPress={() => aski !== null && openChat(aski)}
        hitSlop={8}
      >
        <AskiFigure
          height={ASKI_HEIGHT}
          ink={night ? NIGHT_INK : ink}
          ground={ground}
          mood={pleased ? "pleased" : undefined}
        />
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityHint="Shows another line"
        // What waits on you is said plainly, and only that.
        disabled={counts.input > 0}
        onPress={() => setRolls((n) => n + 1)}
        className="mt-3 self-stretch px-10"
      >
        <Animated.View key={line} entering={FadeIn.duration(220)}>
          <AppText
            className="text-center text-xl"
            style={night ? { color: NIGHT_TEXT } : undefined}
            numberOfLines={2}
          >
            {line}
          </AppText>
        </Animated.View>
      </Pressable>
      {/* A hop lands on its segment (`line/Hops.tsx`). */}
      <View ref={segmentsStandIn} className="mt-5 self-stretch px-4">
        <SegmentedControl
          role="tab"
          options={home.options.map(({ id, label, count }) => ({
            value: id,
            label: count > 0 ? `${label} ${count}` : label,
            accessibilityLabel: `${label}, ${count}`,
          }))}
          selected={home.tab}
          onSelect={home.choose}
        />
      </View>
    </View>
  );
}
