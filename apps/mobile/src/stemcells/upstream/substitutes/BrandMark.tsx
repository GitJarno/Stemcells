// Replaces `components/BrandMark.tsx` (`substitutes.cjs`): upstream's lockup
// on the loading screen, with Stemcells' icon (`brandAssets.ts` here) and its
// wordmark where upstream shows T3's icon and its name, and no release-stage badge.
import { Image } from "expo-image";
import { View } from "react-native";

import { AppText as Text } from "../../../components/ui/AppText";
import { APP_NAME } from "../../brand/name";
import { Wordmark } from "../../brand/Wordmark";
import { T3_CODE_BRAND_MARK_SOURCE } from "./brandAssets";

export function BrandMark(props: { readonly compact?: boolean; readonly stageLabel?: string }) {
  const compact = props.compact ?? false;
  const iconSize = compact ? 32 : 44;

  return (
    <View className="flex-row items-center gap-3">
      <Image
        source={T3_CODE_BRAND_MARK_SOURCE}
        accessibilityIgnoresInvertColors
        style={{
          width: iconSize,
          height: iconSize,
          borderRadius: compact ? 10 : 14,
        }}
      />
      <View className="gap-1.5">
        <View accessible accessibilityLabel={APP_NAME}>
          <Wordmark height={compact ? 14 : 17} />
        </View>
        {!compact ? (
          <Text className="text-xs font-medium text-foreground-muted">
            Mobile control surface for your live coding environments
          </Text>
        ) : null}
      </View>
    </View>
  );
}
