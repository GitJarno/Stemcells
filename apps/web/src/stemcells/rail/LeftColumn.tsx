import { ChevronsLeftIcon } from "lucide-react";
import type { ReactNode } from "react";

import { SidebarFolderDrop } from "../upstream/folderDrop";
import {
  SidebarMenuButton,
  SidebarMenuItem,
  Tooltip,
  TooltipPopup,
  TooltipTrigger,
  useSidebar,
} from "../upstream/ui";
import { useUpdateWanted } from "../updates/wanted";
import { useZoomNotice } from "../zoom/useZoomNotice";
import { Cells } from "./Cells";
import { useColumnStore } from "./column";
import { Rail } from "./Rail";
import { UpdateDriver } from "./UpdateBanner";
// App-wide: the root layout renders this column on every page.
import "../scrollbars/scrollbars.css";
// The frame and the slate every page stands on, loaded with the column for
// the same reason.
import "../pages/frame.css";
// How a reply reads, in every chat.
import "../transcript/reply.css";
import "./folderDrop.css";

/**
 * Upstream's sidebar slot: the Cells' column, the rail, or upstream's list
 * (`wide`) when the person chose it. A phone width gets upstream's, which
 * is a sheet there. A folder dropped on any of them is added as a project:
 * upstream's list carries its own drop zone, ours stand in the same one.
 */
export function LeftColumn(props: { wide: ReactNode }) {
  // App-wide, as the column is: the zoom level shows on every page.
  useZoomNotice();
  const width = useColumnStore((store) => store.width);
  const { isMobile } = useSidebar();
  // An update the person asked for carries on whichever column shows.
  const wanted = useUpdateWanted((store) => store.wanted);
  const column =
    isMobile || width === "list" ? (
      props.wide
    ) : (
      <SidebarFolderDrop>{width === "rail" ? <Rail /> : <Cells />}</SidebarFolderDrop>
    );
  return (
    <>
      {wanted ? <UpdateDriver /> : null}
      {column}
    </>
  );
}

/** In upstream's list's foot, beside the disk: back to the Cells' column. */
export function NarrowColumnButton() {
  const setWidth = useColumnStore((store) => store.setWidth);
  const { isMobile } = useSidebar();
  if (isMobile) return null;
  return (
    <SidebarMenuItem className="shrink-0">
      <Tooltip>
        <TooltipTrigger
          render={
            <SidebarMenuButton
              aria-label="Back to the Cells"
              onClick={() => setWidth("cells")}
              size="icon"
            >
              <ChevronsLeftIcon />
            </SidebarMenuButton>
          }
        />
        <TooltipPopup side="top">Back to the Cells</TooltipPopup>
      </Tooltip>
    </SidebarMenuItem>
  );
}
