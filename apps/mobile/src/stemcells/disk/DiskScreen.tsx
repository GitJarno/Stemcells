import { useState } from "react";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  CLEANUP_PROMISE,
  DISK_NOTICE,
  DISK_WARN,
  diskBytes,
} from "../../../../../stemcells/words/disk.ts";
import {
  AppText,
  Dialog,
  ScreenScrollView,
  SettingsRow,
  SettingsScreen,
  SettingsSection,
  useMachineConnection,
  useMachineDisk,
  useMachines,
} from "../upstream/disk";
import { setNoticeHidden, useHiddenAt } from "./notice";
import { useFreeSpace } from "./useFreeSpace";
import { useWarnBelow } from "./warn";
import { WarnMenu } from "./WarnMenu";

// Settings › Disk on the phone: each machine's free space, and a tap that opens a new Cell
// in that machine's Disk project, the cleanup ask waiting unsent. The phone deletes and
// measures nothing; the Cell does both, on the machine, after the person names what goes.

type Machine = ReturnType<typeof useMachines>[number];

export function DiskScreen() {
  const insets = useSafeAreaInsets();
  const machines = useMachines();
  return (
    <SettingsScreen title="Disk">
      <ScreenScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentInset={{ bottom: Math.max(insets.bottom, 18) }}
        showsVerticalScrollIndicator={false}
        className="flex-1"
        contentContainerClassName="gap-6 px-5 pt-4 pb-[18px]"
      >
        <SettingsSection
          title="Machines"
          footer={`Tap a machine to start a Cell that frees space on it. ${CLEANUP_PROMISE} ${DISK_WARN.note}`}
        >
          {machines.length === 0 ? (
            <AppText className="px-4 py-3 text-sm text-foreground-muted">
              No machines yet: add one in Environments.
            </AppText>
          ) : (
            machines.map((machine, index) => (
              <View
                key={machine.environmentId}
                className={index === 0 ? undefined : "border-t border-border"}
              >
                {machine.connection === "connected" ? (
                  <>
                    <ConnectedMachineRow machine={machine} />
                    <WarnRow machine={machine} />
                    <NoticeRow machine={machine} />
                  </>
                ) : (
                  <SettingsRow
                    icon={machine.icon}
                    label={machine.label}
                    value={machine.connection === "connecting" ? "Connecting…" : "Not connected"}
                    valuePosition="below"
                    disabled
                  />
                )}
              </View>
            ))
          )}
        </SettingsSection>
      </ScreenScrollView>
    </SettingsScreen>
  );
}

/** When the home shows this machine's disk, and its Mac turns it amber. */
function WarnRow({ machine }: { readonly machine: Machine }) {
  const disk = useMachineDisk(machine.environmentId);
  const warnBelow = useWarnBelow(machine.environmentId, disk?.warnBelow);
  return (
    <View className="border-t border-border">
      <WarnMenu environmentId={machine.environmentId} warnBelow={warnBelow}>
        <View>
          <SettingsRow icon="bell.badge" label={DISK_WARN.title} value={diskBytes(warnBelow)} />
        </View>
      </WarnMenu>
    </View>
  );
}

/** While the home's notice for this machine is swiped away: the way to show it again. */
function NoticeRow({ machine }: { readonly machine: Machine }) {
  const disk = useMachineDisk(machine.environmentId);
  const connection = useMachineConnection(machine.environmentId);
  const hiddenAt = useHiddenAt(machine.environmentId, disk?.hiddenAt);
  if (connection === null || hiddenAt === undefined) return null;
  return (
    <View className="border-t border-border">
      <SettingsRow
        icon="eye.slash"
        label={DISK_NOTICE.show}
        value={DISK_NOTICE.until}
        valuePosition="below"
        onPress={() => {
          void setNoticeHidden(machine.environmentId, connection, null).then((shown) => {
            if (!shown) Dialog.alert(DISK_NOTICE.showFailed, "Try again in a moment.");
          });
        }}
      />
    </View>
  );
}

function ConnectedMachineRow({ machine }: { readonly machine: Machine }) {
  const disk = useMachineDisk(machine.environmentId);
  const freeSpace = useFreeSpace(machine.environmentId, "replace");
  // One Cell per tap: a second tap while the first opens would leave a
  // second draft with the whole ask behind it, unseen.
  const [opening, setOpening] = useState(false);
  const space =
    disk === undefined
      ? "Reading the disk…"
      : disk === null
        ? "Free space unknown"
        : `${diskBytes(disk.free)} free of ${diskBytes(disk.total)}`;
  return (
    <SettingsRow
      icon={machine.icon}
      label={machine.label}
      value={freeSpace ? space : `${space} · It can't start a Cell to free space.`}
      valuePosition="below"
      disabled={freeSpace === null || opening}
      onPress={() => {
        if (freeSpace === null) return;
        setOpening(true);
        void freeSpace().finally(() => setOpening(false));
      }}
    />
  );
}
