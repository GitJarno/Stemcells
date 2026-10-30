import { useNavigate } from "@tanstack/react-router";
import { HardDriveIcon } from "lucide-react";

import {
  SidebarMenuButton,
  SidebarMenuItem,
  Tooltip,
  TooltipPopup,
  TooltipTrigger,
  useSidebar,
} from "../upstream/ui";
import { diskBytes } from "../../../../../stemcells/words/disk.ts";
import { useDiskFree } from "./diskReading";
import { diskPressure, FOOT_TONE, freeFigure } from "./pressure";

// The disk at the sidebar's foot, beside Settings and Usage: the space left
// on this machine's disk, green, then yellow, then red as it runs short.
// A click opens Settings › Disk. Nothing shows until the first reading.

export function DiskFoot() {
  const volume = useDiskFree();
  const navigate = useNavigate();
  const { isMobile, setOpenMobile } = useSidebar();
  if (volume === null) return null;

  const figure = freeFigure(volume.free);
  const label = `${figure} left of ${diskBytes(volume.total)}`;
  const open = () => {
    if (isMobile) setOpenMobile(false);
    void navigate({ to: "/settings/disk" });
  };

  return (
    <SidebarMenuItem className="shrink-0">
      <Tooltip>
        <TooltipTrigger
          render={
            <SidebarMenuButton aria-label={`Disk: ${label}`} className="w-auto" onClick={open}>
              <HardDriveIcon />
              <span
                className={`text-xs tabular-nums ${FOOT_TONE[diskPressure(volume.free, volume.warnBelow)]}`}
              >
                {figure}
              </span>
            </SidebarMenuButton>
          }
        />
        <TooltipPopup side="top">{label}</TooltipPopup>
      </Tooltip>
    </SidebarMenuItem>
  );
}
