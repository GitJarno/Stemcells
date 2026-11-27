// The stages at the home's foot, just over its search, where a thumb reaches them and they never
// scroll away, as the Mac's column keeps its stages at its foot (stemcells/tasks/awake-asleep.md).
// Each list's top is its own: Asleep's is the night sky, which scrolls away with it.

import { use, useEffect } from "react";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useResolveClassNames } from "uniwind";

import { NativePrimaryColumnContext, SegmentedControl, useOverSearch } from "../upstream/home";
import { Night } from "./Night";
import { HomeInFront, HomeStageContext, HomeTabsContext, liftNotices, PILL_ROOM } from "./state";

/** Asleep's sky over its list, room for the moon and the stars. */
const SKY = 88;
/** Room over Awake's first row. */
const ROOM = 8;
/** How far the night reaches over the sky: the header and the status bar, and a pull past the top. */
const NIGHT_ABOVE = 600;

/** The stages, over the home's search. */
export function StagePill() {
  const home = use(HomeTabsContext);
  const inFront = use(HomeInFront);
  const place = useOverSearch();
  const lift = place.pill + PILL_ROOM - place.notice;
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Tell T3's undo notice, drawn outside the home, to stand over the stages.
  useEffect(() => (inFront ? liftNotices(lift) : undefined), [inFront, lift]);
  if (home === null) return null;
  return (
    <View
      pointerEvents="box-none"
      style={{ position: "absolute", bottom: place.pill, left: place.left, right: place.right }}
    >
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
  );
}

/** A stage's list's top: Asleep's night sky, a little room over Awake's first row. */
export function StageTop() {
  const stage = use(HomeStageContext);
  if (stage === null) return null;
  return stage === "asleep" ? <Sky /> : <View style={{ height: ROOM }} />;
}

function Sky() {
  const primaryColumn = use(NativePrimaryColumnContext);
  const inFront = use(HomeInFront);
  const insets = useSafeAreaInsets();
  const screen = useResolveClassNames(primaryColumn ? "bg-drawer" : "bg-screen").backgroundColor;
  return (
    <View pointerEvents="none" style={{ height: SKY }}>
      <Night above={NIGHT_ABOVE + insets.top} screen={screen} height={SKY} shooting={inFront} />
    </View>
  );
}
