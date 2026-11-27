// The wait before the share sheet opens, which on a slow link outlasts the closed menu: the
// file's name, how far it has come, and Cancel. It leaves when the sheet opens, on Cancel or on
// an error (`transfer.ts`). Mounted once for the app (`push/PushCoordinator.tsx`); English only,
// as our layer is (`stemcells/seams/rest.md`).
import { Platform, Pressable, View, type ViewStyle } from "react-native";
import Animated, { FadeIn, FadeOut, ReduceMotion } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FullWindowOverlay } from "react-native-screens";

import { AppText, formatBytes, OverlayPortal } from "../upstream/share";
import { type Transfer, useShownTransfer } from "./transfer";

/** The bottom bar or a chat's composer, which the card stands over (as a feat's moment does). */
const BOTTOM_CHROME = 64;
const NUMBERS = { fontVariant: ["tabular-nums" as const] };
const FLOATS = {
  shadowColor: "#000000",
  shadowOpacity: 0.3,
  shadowRadius: 14,
  shadowOffset: { width: 0, height: 4 },
  elevation: 8,
} satisfies ViewStyle;
const ARRIVES = FadeIn.duration(160).reduceMotion(ReduceMotion.System);
const LEAVES = FadeOut.duration(120).reduceMotion(ReduceMotion.System);

export function TransferCard() {
  const transfer = useShownTransfer();
  if (transfer === null) return null;
  const card = <Card key={transfer.id} transfer={transfer} />;
  return (
    <OverlayPortal>
      {/* Over a sheet too: the file viewer's actions share from one. */}
      {Platform.OS === "ios" ? <FullWindowOverlay>{card}</FullWindowOverlay> : card}
    </OverlayPortal>
  );
}

/** What the card's second line says: the share of the file so far, or its bytes. */
function transferSaid(transfer: Pick<Transfer, "written" | "total">): string {
  if (transfer.total !== null) {
    const percent = Math.min(100, Math.floor((transfer.written * 100) / transfer.total));
    return `${percent}% of ${formatBytes(transfer.total)}`;
  }
  return transfer.written === 0 ? "Downloading…" : `${formatBytes(transfer.written)} downloaded`;
}

function Card({ transfer }: { readonly transfer: Transfer }) {
  const insets = useSafeAreaInsets();
  const fraction = transfer.total === null ? null : Math.min(1, transfer.written / transfer.total);
  const said = transferSaid(transfer);
  return (
    <View pointerEvents="box-none" className="absolute inset-0 items-center justify-end">
      <Animated.View
        entering={ARRIVES}
        exiting={LEAVES}
        pointerEvents="box-none"
        className="w-full max-w-[440px] px-3"
        style={{ paddingBottom: Math.max(insets.bottom, 12) + BOTTOM_CHROME }}
      >
        <View
          style={FLOATS}
          className="flex-row items-center gap-2 rounded-2xl border border-border bg-grouped-card py-3 pl-4 pr-1"
        >
          <View
            accessible
            accessibilityRole="progressbar"
            accessibilityLabel={`Downloading ${transfer.name}`}
            accessibilityValue={
              fraction === null
                ? { text: said }
                : { min: 0, max: 100, now: Math.floor(fraction * 100) }
            }
            className="min-w-0 flex-1 gap-1.5"
          >
            <AppText
              className="text-sm font-t3-medium text-foreground"
              numberOfLines={1}
              ellipsizeMode="middle"
            >
              {transfer.name}
            </AppText>
            {fraction === null ? null : (
              <View className="h-1 overflow-hidden rounded-full bg-border">
                <View
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${fraction * 100}%` }}
                />
              </View>
            )}
            <AppText className="text-xs text-foreground-muted" style={NUMBERS}>
              {said}
            </AppText>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Cancel download"
            onPress={transfer.cancel}
            className="min-h-11 justify-center px-3 active:opacity-70"
          >
            <AppText className="text-sm text-primary-text">Cancel</AppText>
          </Pressable>
        </View>
      </Animated.View>
    </View>
  );
}
