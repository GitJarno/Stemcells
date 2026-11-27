// Usage's way into the collection (`stemcells/tasks/duo-collection.md`). In the Duo's rail the
// trophy is ours, after the top group and over Aski: T3 folds a second header tool there into
// one "…" menu. Elsewhere it's a button in Usage's header, handed over at T3's seam
// (`features/usage/UsageRouteScreen.tsx`).

import { useNavigation } from "@react-navigation/native";
import * as Haptics from "expo-haptics";
import { Platform, Pressable, useWindowDimensions } from "react-native";
import Animated, { Easing, LinearTransition } from "react-native-reanimated";
import { FullWindowOverlay } from "react-native-screens";
import { Fragment, use, useState } from "react";

import { COLLECTION } from "../../../../../stemcells/words/feats.ts";
import { railStyle, useRail, useRailTrophy } from "../aski/rail";
import {
  GlassSurface,
  NativeWorkspaceTabActivityContext,
  SymbolView,
  useNativeLayoutMetrics,
} from "../upstream/askiTurn";

/** Aski's button's size, so the two read as one pair. */
const SIZE = 52;

/** Upstream's Android icons have no trophy: a star there. */
export const COLLECTION_ICON =
  Platform.OS === "ios" ? ({ ios: "trophy", android: "public" } as const) : ("star" as const);

/** Usage's header actions: the trophy there off the rail; on the rail, none, and the trophy asked for. */
export function useCollectionTrophy() {
  const navigation = useNavigation();
  const metrics = useNativeLayoutMetrics();
  const window = useWindowDimensions();
  // One function for the screen's life, so the rail's store hears of it once.
  const [open] = useState(() => () => navigation.navigate("SettingsCollection"));
  const onRail = railStyle({ metrics, window, top: null, index: 0, ours: 1, size: SIZE }) !== null;
  // A tab T3 keeps mounted behind another isn't in front.
  const active = use(NativeWorkspaceTabActivityContext)?.active !== false;
  useRailTrophy(onRail && active ? open : null);
  return onRail
    ? undefined
    : [{ accessibilityLabel: COLLECTION.title, icon: COLLECTION_ICON, onPress: open }];
}

const Above = Platform.OS === "ios" ? FullWindowOverlay : Fragment;

/** The trophy in the Duo's rail while Usage is in front. Mounted once over the workspace (`pages.tsx`). */
export function RailTrophy() {
  const metrics = useNativeLayoutMetrics();
  const window = useWindowDimensions();
  const { top, trophy, ours } = useRail();
  const style =
    trophy === null ? null : railStyle({ metrics, window, top, index: 0, ours, size: SIZE });
  return (
    <Above>
      {style === null || trophy === null ? null : (
        <Animated.View
          pointerEvents="box-none"
          layout={GLIDE}
          style={{ position: "absolute", ...style }}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={COLLECTION.title}
            onPress={() => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              trophy();
            }}
            hitSlop={6}
          >
            <GlassSurface
              className="items-center justify-center rounded-full"
              style={{ width: SIZE, height: SIZE }}
            >
              <SymbolView name={COLLECTION_ICON} size={20} tintColorClassName="accent-foreground" />
            </GlassSurface>
          </Pressable>
        </Animated.View>
      )}
    </Above>
  );
}

const GLIDE = LinearTransition.duration(240).easing(Easing.out(Easing.cubic));
