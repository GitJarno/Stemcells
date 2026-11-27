// The tray over Aski's composer (stemcells/tasks/aski-orchestrator.md, decisions 4, 5 and 12):
// from the moment a message is being read until its plan is settled, a compact panel standing
// directly on the composer, in the thumb's reach. One quiet line while Aski reads, then the
// plan's rows. It scrolls inside itself, and stands lower while the keyboard is up.

import { useEffect, useState } from "react";
import { ScrollView, useWindowDimensions, View } from "react-native";
import Animated from "react-native-reanimated";

import { FLOOR_LINE, headline } from "../../../../../../stemcells/words/plans.ts";
import { entering, exiting } from "../../home/listMotion";
import { AppText, useIsFocused, useKeyboardState } from "../../upstream/plans";
import { PlanPanel, usePlans } from "./PlanRows";
import { standing } from "./standing";
import { overComposer, type PlanEntry } from "./trays";
import { usePlanWorld } from "./usePlanWorld";

export function PlanTray(props: {
  readonly environmentId: string;
  readonly threadId: string;
  readonly maxWidth?: number | undefined;
}) {
  const over = overComposer(usePlans(), props.environmentId, props.threadId);
  return over.length === 0 ? null : (
    <Standing environmentId={props.environmentId} maxWidth={props.maxWidth} entries={over} />
  );
}

function Standing(props: {
  readonly environmentId: string;
  readonly maxWidth?: number | undefined;
  readonly entries: ReadonlyArray<PlanEntry>;
}) {
  const { places, models } = usePlanWorld(props.environmentId);
  const window = useWindowDimensions();
  const keyboard = useKeyboardState((state) => state.isVisible);
  // Over a keyboard the chat keeps a strip of its own above the tray.
  const most = keyboard ? Math.max(132, window.height * 0.24) : Math.min(440, window.height * 0.46);
  const focused = useIsFocused();
  const [height, setHeight] = useState(0);
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Aski's button floats over every screen from a layer of its own: it is told how tall the tray stands while this chat is in front.
  useEffect(() => {
    standing.set(focused ? height : 0);
    return () => standing.set(0);
  }, [focused, height]);
  return (
    <Animated.View
      entering={entering()}
      exiting={exiting()}
      onLayout={(event) => setHeight(event.nativeEvent.layout.height)}
      className="w-full self-center px-[12px] pb-1.5"
      style={{ maxWidth: props.maxWidth }}
    >
      <View className="overflow-hidden rounded-[20px] border border-border bg-card-alt">
        <ScrollView
          style={{ maxHeight: most }}
          bounces={false}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {props.entries.map((entry, index) => (
            <View
              key={entry.id}
              className={index > 0 ? "border-t border-border" : undefined}
              accessibilityLiveRegion="polite"
            >
              {entry.state === "tray" ? (
                <PlanPanel entry={entry} places={places} models={models} open={false} />
              ) : (
                <AppText className="px-4 py-3 text-sm text-foreground-muted">
                  {entry.state === "floor" ? FLOOR_LINE : headline(0, 0, 0, true)}
                </AppText>
              )}
            </View>
          ))}
        </ScrollView>
      </View>
    </Animated.View>
  );
}
