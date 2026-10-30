import * as Haptics from "expo-haptics";
import { useState } from "react";
import { View, type ViewStyle } from "react-native";
import { useResolveClassNames } from "uniwind";

import { DISK_FULL, DISK_NOTICE } from "../../../../../stemcells/words/disk.ts";
import { held } from "../line/heldLine";
import {
  AppText,
  Button,
  Dialog,
  SymbolView,
  ThreadSwipeable,
  useMachineConnection,
  useMachineDisk,
  useMachines,
  withThreadDismissal,
} from "../upstream/disk";
import { diskPressure, freeFigure, FULL_BELOW, noticeShown } from "./kit";
import { setNoticeHidden, useHiddenAt } from "./notice";
import { useFreeSpace } from "./useFreeSpace";
import { useWarnBelow } from "./warn";
import { WarnMenu } from "./WarnMenu";

// The phone's home shows a machine only once its disk wants attention: a card under the tabs
// (`home/AskiHome.tsx`) with Free space and a cog for when it should. Swiped left as a Cell's
// card is, it hides on every device until the disk has news (`stemcells/disk/notice.ts`),
// with Undo on the home's line.

/** Inset as a Cell's card is (`thread-list-v2-row-appearance.ts`), so the swipe stays inside. */
const CARD = {
  marginHorizontal: 12,
  marginTop: 12,
  borderRadius: 20,
  overflow: "hidden",
} satisfies ViewStyle;

const useConnected = () => useMachines().filter((machine) => machine.connection === "connected");

export function DiskPlates() {
  return useConnected().map((machine) => (
    <DiskPlate
      key={machine.environmentId}
      environmentId={machine.environmentId}
      label={machine.label}
    />
  ));
}

/**
 * Reads each machine's disk while the home is up. The plates mount again with each tab's list,
 * and with no reader between two lists, a machine's figures were let go and read again.
 */
export function DiskReaders() {
  return useConnected().map((machine) => (
    <DiskReader key={machine.environmentId} environmentId={machine.environmentId} />
  ));
}

function DiskReader(props: { readonly environmentId: string }) {
  useMachineDisk(props.environmentId);
  return null;
}

function DiskPlate(props: {
  readonly environmentId: string;
  /** Its machine's name, even when it's the only one: the phone is never it. */
  readonly label: string;
}) {
  const disk = useMachineDisk(props.environmentId);
  const freeSpace = useFreeSpace(props.environmentId);
  const connection = useMachineConnection(props.environmentId);
  const warnBelow = useWarnBelow(props.environmentId, disk?.warnBelow);
  const hiddenAt = useHiddenAt(props.environmentId, disk?.hiddenAt);
  const card = useResolveClassNames("bg-grouped-card").backgroundColor ?? "transparent";
  const [opening, setOpening] = useState(false);
  const [width, setWidth] = useState(0);
  if (disk == null || !noticeShown({ free: disk.free, warnBelow, hiddenAt })) return null;
  const urgent = diskPressure(disk.free, warnBelow) === "now";
  const headline = disk.free < FULL_BELOW ? DISK_FULL.title : `${freeFigure(disk.free)} left`;
  const key = `disk-notice:${props.environmentId}`;
  const hide = async () => {
    if (connection === null) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const hidden = await withThreadDismissal(
      key,
      () => setNoticeHidden(props.environmentId, connection, disk.free),
      Boolean,
    );
    if (!hidden) return Dialog.alert(DISK_NOTICE.hideFailed, "Try again in a moment.");
    void held.did({
      key,
      words: DISK_NOTICE.hidden,
      takeBack: async () => {
        if (!(await setNoticeHidden(props.environmentId, connection, null))) {
          Dialog.alert(DISK_NOTICE.showFailed, "Try again in a moment.");
        }
      },
    });
  };
  return (
    <View onLayout={({ nativeEvent }) => setWidth(nativeEvent.layout.width)}>
      <ThreadSwipeable
        threadKey={key}
        threadTitle={props.label}
        backgroundColor={card}
        containerStyle={CARD}
        enabled={connection !== null}
        enableTrackpadSwipe
        fullSwipeAction="primary"
        fullSwipeWidth={width - CARD.marginHorizontal * 2}
        onDelete={() => void hide()}
        primaryAction={{
          accessibilityLabel: DISK_NOTICE.hideLabel,
          icon: "eye.slash",
          label: DISK_NOTICE.hide,
          onPress: () => void hide(),
        }}
        secondaryAction={null}
      >
        {() => (
          <View className="flex-row items-center gap-3 px-4 py-3">
            <SymbolView
              name="internaldrive"
              size={18}
              weight="medium"
              tintColorClassName={urgent ? "accent-danger-foreground" : "accent-warning-foreground"}
              type="monochrome"
            />
            <View className="min-w-0 flex-1">
              <AppText
                className={
                  urgent
                    ? "font-t3-medium text-sm text-danger-foreground"
                    : "font-t3-medium text-sm text-warning-foreground"
                }
                numberOfLines={1}
              >
                {headline}
              </AppText>
              <AppText className="text-xs text-foreground-muted" numberOfLines={1}>
                {props.label}
              </AppText>
            </View>
            {freeSpace === null ? null : (
              <Button
                label={DISK_FULL.action}
                tone="secondary"
                loading={opening}
                onPress={() => {
                  setOpening(true);
                  void freeSpace().finally(() => setOpening(false));
                }}
              />
            )}
            <WarnMenu environmentId={props.environmentId} warnBelow={warnBelow}>
              <View className="size-9 items-center justify-center">
                <SymbolView
                  name="gearshape"
                  size={18}
                  tintColorClassName="accent-icon"
                  type="monochrome"
                />
              </View>
            </WarnMenu>
          </View>
        )}
      </ThreadSwipeable>
    </View>
  );
}
