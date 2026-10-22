import { useState } from "react";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  cleanupAsk,
  CLEANUP_PROMISE,
  diskBytes,
  ITS_OWN_MACHINE,
} from "../../../../../stemcells/words/disk.ts";
import {
  AppText,
  Dialog,
  ScreenScrollView,
  SettingsRow,
  SettingsScreen,
  SettingsSection,
  useMachineDisk,
  useMachines,
  useOpenCellWithDraft,
} from "../upstream/disk";

// Settings › Disk on the phone: each machine's free space, and a tap that
// opens a new Cell on that machine with the cleanup ask waiting, unsent.
// The phone deletes nothing and measures nothing; the Cell does both, on
// the machine, after the person names what goes.

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
          footer={`Tap a machine to start a Cell that frees space on it. ${CLEANUP_PROMISE}`}
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
                  <ConnectedMachineRow machine={machine} />
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

function ConnectedMachineRow({ machine }: { readonly machine: Machine }) {
  const disk = useMachineDisk(machine.environmentId);
  const openCell = useOpenCellWithDraft(machine.environmentId);
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
      value={openCell ? space : `${space} · Add a project there to start a Cell on it.`}
      valuePosition="below"
      disabled={openCell === null || opening}
      onPress={() => {
        if (openCell === null) return;
        setOpening(true);
        void freeSpace(openCell).finally(() => setOpening(false));
      }}
    />
  );
}

async function freeSpace(
  openCell: NonNullable<ReturnType<typeof useOpenCellWithDraft>>,
): Promise<void> {
  if (!(await openCell(cleanupAsk(ITS_OWN_MACHINE)))) {
    Dialog.alert("Couldn't start a Cell", "Try again in a moment.");
  }
}
