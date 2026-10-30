import type { ReactElement } from "react";

import { DISK_WARN, diskBytes } from "../../../../../stemcells/words/disk.ts";
import { Dialog, Menu, useMachineConnection } from "../upstream/disk";
import { WARN_CHOICES } from "./kit";
import { chooseWarnBelow } from "./warn";

/** How little free space warns about a machine, chosen from a native menu over `children`. */
export function WarnMenu(props: {
  readonly environmentId: string;
  readonly warnBelow: number;
  readonly children: ReactElement;
}) {
  const connection = useMachineConnection(props.environmentId);
  if (connection === null) return null;
  const choose = async (warnBelow: number) => {
    if (!(await chooseWarnBelow(props.environmentId, connection, warnBelow))) {
      Dialog.alert(DISK_WARN.failed, "Try again in a moment.");
    }
  };
  return (
    <Menu
      title={DISK_WARN.menuTitle}
      actions={WARN_CHOICES.map((choice) => ({
        id: String(choice),
        title: diskBytes(choice),
        state: choice === props.warnBelow ? ("on" as const) : ("off" as const),
      }))}
      onPressAction={({ nativeEvent }) => {
        const choice = Number(nativeEvent.event);
        if (choice !== props.warnBelow) void choose(choice);
      }}
      accessibilityLabel={DISK_WARN.label}
      accessibilityRole="button"
    >
      {props.children}
    </Menu>
  );
}
