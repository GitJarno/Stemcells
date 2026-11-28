// Replaces `components/CompactBrandTitle.tsx` (`substitutes.cjs`): Stemcells' wordmark where
// upstream draws the T3 logo beside "Code", as the web's sidebar does (`brand/Wordmark.tsx`
// there), and no release-stage badge beside it. The offset and the logo's height are upstream's.
import { useState } from "react";
import { Platform, View } from "react-native";

import { brandTitleOffset } from "../../../components/CompactBrandTitle";
import { useAndroidControlSizing } from "../../../components/ui/useAndroidControlSizing";
import { BatteryMarks } from "../../battery/BatteryMarks";
import { APP_NAME } from "../../brand/name";
import { Wordmark } from "../../brand/Wordmark";

export { brandTitleOffset };

export function CompactBrandTitle(
  props: {
    readonly allowFontScaling?: boolean;
    readonly accessibilityLabel?: string;
    /** Fills the parent row, leaving the battery marks the room the title doesn't take. */
    readonly fit?: boolean;
  } = {},
) {
  const titleOffset = brandTitleOffset();
  const { scale } = useAndroidControlSizing();
  const [availableWidth, setAvailableWidth] = useState<number | null>(null);
  const [fullWidth, setFullWidth] = useState<number | null>(null);

  const title = (
    <View
      onLayout={props.fit ? (event) => setFullWidth(event.nativeEvent.layout.width) : undefined}
      aria-level={1}
      accessibilityLabel={props.accessibilityLabel ?? `${APP_NAME}, Cells`}
      accessible
      role="heading"
      className="flex-row items-center gap-1.5"
      style={[
        { marginLeft: titleOffset },
        Platform.OS === "android" && { gap: 5.25 * scale },
        props.fit && { flexShrink: 0 },
      ]}
    >
      <Wordmark height={Math.round(15 * scale)} />
    </View>
  );

  return props.fit ? (
    <View
      className="min-w-0 flex-1 flex-row items-center"
      onLayout={(event) => setAvailableWidth(event.nativeEvent.layout.width)}
    >
      {title}
      {/* The workspace's own title, on iOS: Android's header is T3's. */}
      {Platform.OS === "ios" ? (
        <BatteryMarks
          room={availableWidth === null || fullWidth === null ? null : availableWidth - fullWidth}
        />
      ) : null}
    </View>
  ) : (
    title
  );
}
