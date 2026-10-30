import { useState } from "react";
import { View } from "react-native";

import { DISK_FULL } from "../../../../../stemcells/words/disk.ts";
import { AppText, Button, SymbolView, useMachineDisk, useMachines } from "../upstream/disk";
import { diskPressure, freeFigure, FULL_BELOW } from "./kit";
import { useFreeSpace } from "./useFreeSpace";
import { useWarnBelow } from "./warn";
import { WarnMenu } from "./WarnMenu";

// The home's disk: the Mac's column ends on its disk, grey while there's room, amber, then red;
// on the phone, whose home is for its Cells, a machine shows only once its disk wants
// attention, with Free space beside it and a cog for when it should: a card under the tabs
// (`home/AskiHome.tsx`).

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
  const warnBelow = useWarnBelow(props.environmentId, disk?.warnBelow);
  const [opening, setOpening] = useState(false);
  if (disk == null) return null;
  const pressure = diskPressure(disk.free, warnBelow);
  if (pressure === "calm") return null;
  const urgent = pressure === "now";
  const headline = disk.free < FULL_BELOW ? DISK_FULL.title : `${freeFigure(disk.free)} left`;
  return (
    <View className="mx-3 mt-3 flex-row items-center gap-3 rounded-[20px] bg-grouped-card px-4 py-3">
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
  );
}
