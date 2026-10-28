import { useState, type ReactNode } from "react";
import { View } from "react-native";

import { DISK_FULL } from "../../../../../stemcells/words/disk.ts";
import { AppText, Button, SymbolView, useMachineDisk } from "../upstream/disk";
import { diskFailure } from "./kit";
import { useFreeSpace } from "./useFreeSpace";

// A Cell's failed turn while its machine's disk is full: "The disk is full", with Free space,
// which opens the cleanup Cell there; once there's room again it says so. Any other failure,
// or one before the machine's first reading, is `fallback`: T3's row. As the Mac's row says.

export function DiskFullRow(props: {
  readonly entryId: string;
  readonly environmentId: string;
  readonly createdAt: string;
  readonly fallback: ReactNode;
}) {
  const disk = useMachineDisk(props.environmentId);
  const failure = disk == null ? null : diskFailure(props.entryId, disk.free);
  if (failure === null) return props.fallback;

  const full = failure === "full";
  const at = new Date(props.createdAt);
  return (
    <View className="flex-1 py-1">
      <View className="flex-row items-center gap-1.5">
        <View className="h-6 w-6 shrink-0 items-center justify-center">
          <SymbolView
            name="internaldrive"
            size={14}
            weight="medium"
            tintColorClassName={full ? "accent-danger-foreground" : "accent-foreground-muted"}
            type="monochrome"
          />
        </View>
        <AppText
          className={
            full
              ? "min-w-0 flex-1 font-t3-medium text-sm text-adaptive-rose-600-400"
              : "min-w-0 flex-1 font-t3-medium text-sm text-foreground"
          }
        >
          {full ? DISK_FULL.title : DISK_FULL.freedTitle}
        </AppText>
        <AppText
          accessibilityLabel={at.toLocaleString()}
          className="shrink-0 text-xs text-foreground-subtle"
        >
          {at.toLocaleString(undefined, {
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
          })}
        </AppText>
      </View>
      <AppText selectable className="ml-7 text-sm text-foreground">
        {full ? DISK_FULL.note : DISK_FULL.freedNote}
      </AppText>
      {full ? <FreeSpaceButton environmentId={props.environmentId} /> : null}
    </View>
  );
}

/** Its own component, so only a full disk's row reads what opening a Cell takes. */
function FreeSpaceButton(props: { readonly environmentId: string }) {
  const freeSpace = useFreeSpace(props.environmentId);
  const [opening, setOpening] = useState(false);
  if (freeSpace === null) return null;
  return (
    <View className="ml-7 mt-2">
      <Button
        label={DISK_FULL.action}
        tone="secondary"
        icon="internaldrive"
        loading={opening}
        onPress={() => {
          setOpening(true);
          void freeSpace().finally(() => setOpening(false));
        }}
      />
    </View>
  );
}
