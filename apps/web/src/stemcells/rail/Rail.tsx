import { useLocation, useNavigate } from "@tanstack/react-router";
import {
  ChartNoAxesColumnIcon,
  ChevronsRightIcon,
  SearchIcon,
  SettingsIcon,
  SquarePenIcon,
} from "lucide-react";
import { useLayoutEffect } from "react";

import { openNewCellPane } from "../tabs/commands";
import { isElectron, openSearch, SidebarUpdatePill, useShortcutLabel } from "../upstream/rail";
import { useNavigateToMainApp } from "../upstream/settings";
import { cn, useSidebar } from "../upstream/ui";
import { useColumnStore } from "./column";
import { DiskGauge } from "./DiskGauge";
import { litFor } from "./lit";
import { PlanRing } from "./PlanRing";
import { RailButton } from "./RailParts";
import { RailProjects } from "./RailProjects";
import { useRailUndoNotice } from "./undoNotice";
import "../tokens/stemcells.css";
import "./rail.css";

/**
 * The left column at its smallest: search and a new Cell, a badge for each
 * project with a chat, and the foot (update, settings, usage, plans, disk). It
 * stands in upstream's sidebar, which takes the rail's width while it shows
 * (rail.css); upstream's toggle hides and shows it as it does the wide one.
 */
export function Rail() {
  const navigate = useNavigate();
  const lit = useLocation({ select: (location) => litFor(location.pathname) });
  const onSettings = lit === "settings";
  const onUsage = lit === "usage";
  const backToWork = useNavigateToMainApp();
  const searchKeys = useShortcutLabel("commandPalette.toggle");
  const setWidth = useColumnStore((store) => store.setWidth);
  // Upstream's toggle can hide the rail, and Settings has no ⌘Z to undo with.
  const { open } = useSidebar();
  useRailUndoNotice(open && lit !== "settings" && lit !== "disk");

  useLayoutEffect(() => {
    const root = document.documentElement;
    root.dataset.stemcellsColumn = "rail";
    return () => {
      delete root.dataset.stemcellsColumn;
    };
  }, []);

  return (
    <div data-stemcells-rail="">
      {/* Upstream's sidebar button, or the window's controls, stand here. */}
      <div data-stemcells-rail-titlebar="" className={cn(isElectron && "drag-region")} />
      <RailButton label="Search" detail={searchKeys} onClick={openSearch}>
        <SearchIcon />
      </RailButton>
      <RailButton
        label="New Cell"
        detail="⌘T"
        onClick={() => {
          if (!openNewCellPane()) void navigate({ to: "/" });
        }}
      >
        <SquarePenIcon />
      </RailButton>
      <RailProjects />
      <div data-stemcells-rail-foot="">
        <ul data-stemcells-rail-update="">
          <SidebarUpdatePill />
        </ul>
        <RailButton
          label="Settings"
          on={onSettings}
          onClick={() => void (onSettings ? backToWork() : navigate({ to: "/settings" }))}
        >
          <SettingsIcon />
        </RailButton>
        <RailButton label="Usage" on={onUsage} onClick={() => void navigate({ to: "/usage" })}>
          <ChartNoAxesColumnIcon />
        </RailButton>
        <PlanRing on={onUsage} />
        <DiskGauge on={lit === "disk"} />
        <RailButton label="Widen the column" onClick={() => setWidth("wide")}>
          <ChevronsRightIcon />
        </RailButton>
      </div>
    </div>
  );
}
