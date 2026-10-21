import { ChevronsLeftIcon } from "lucide-react";
import type { ReactNode } from "react";

import {
  SidebarMenuButton,
  SidebarMenuItem,
  Tooltip,
  TooltipPopup,
  TooltipTrigger,
  useSidebar,
} from "../upstream/ui";
import { useZoomNotice } from "../zoom/useZoomNotice";
import { useColumnStore } from "./column";
import { Rail } from "./Rail";
// App-wide: the root layout renders this column on every page.
import "../scrollbars/scrollbars.css";
// The frame and the slate every page stands on, loaded with the column for
// the same reason.
import "../pages/frame.css";

/**
 * Upstream's sidebar slot: the rail, or upstream's wide sidebar (`wide`)
 * when the person widened it. A phone width gets upstream's, which is a
 * sheet there.
 */
export function LeftColumn(props: { wide: ReactNode }) {
  // App-wide, as the column is: the zoom level shows on every page.
  useZoomNotice();
  const width = useColumnStore((store) => store.width);
  const { isMobile } = useSidebar();
  return isMobile || width === "wide" ? props.wide : <Rail />;
}

/** In the wide sidebar's foot, beside the disk: back to the rail. */
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
              aria-label="Narrow the column"
              onClick={() => setWidth("rail")}
              size="icon"
            >
              <ChevronsLeftIcon />
            </SidebarMenuButton>
          }
        />
        <TooltipPopup side="top">Narrow the column</TooltipPopup>
      </Tooltip>
    </SidebarMenuItem>
  );
}
