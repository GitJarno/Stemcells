import { useLocation, useNavigate } from "@tanstack/react-router";
import {
  ChartNoAxesColumnIcon,
  ChevronsLeftIcon,
  ListIcon,
  SearchIcon,
  SettingsIcon,
  SquarePenIcon,
} from "lucide-react";
import { useEffect, useLayoutEffect, useState, useSyncExternalStore, type ReactNode } from "react";

import { CardList, useUndoKey } from "../needs/CardList";
import { page } from "../needs/live";
import { useNeeds } from "../needs/stream";
import type { CellStanding } from "../needs/wire";
import { CellMark } from "../tabs/CellMark";
import { openNewCellPane } from "../tabs/commands";
import { useOpenCell, useShelves, type ShelvedCell } from "../upstream/column";
import { useOpenFromNeeds, usePrimaryEnvironmentId } from "../upstream/needs";
import { isElectron, openSearch, SidebarUpdatePill, useShortcutLabel } from "../upstream/rail";
import { useNavigateToMainApp } from "../upstream/settings";
import { useSettleCell } from "../upstream/settle";
import { useCellPlace } from "../upstream/thread";
import { cn, useSidebar } from "../upstream/ui";
import { CellMini } from "./CellMini";
import { useColumnStore, type ColumnStage } from "./column";
import { Hops } from "./Hops";
import { standingsOf, type Standings } from "./moves";
import { DiskGauge } from "./DiskGauge";
import { litFor } from "./lit";
import { PlanRing } from "./PlanRing";
import { RailButton } from "./RailParts";
import { useRailUndoNotice } from "./undoNotice";
import { UpdateBanner, useUpdateToTake } from "./UpdateBanner";
import "../tokens/stemcells.css";
import "./rail.css";
import "../needs/needs.css";
import "./cells.css";

/** Cells a stage's row shows beside its count. */
const MINIS = 3;

const NO_STANDINGS: Standings = new Map();

/** Settled Cells the list shows before search takes over. */
const SETTLED_SHOWN = 30;

const LABEL: Record<ColumnStage, string> = {
  needs: "Needs you",
  working: "Working",
  landed: "Landed",
  settled: "Settled",
  pinned: "Pinned",
};

type Ref = { readonly environmentId: string; readonly threadId: string };

/**
 * The left column as the Cells' line (stemcells/tasks/left-column.md): what
 * needs you on top, open by default, and every stage a row at the foot that
 * opens it in its place. It reads the Cells, never the route, so moving
 * between tabs leaves it as it is.
 */
export function Cells() {
  const navigate = useNavigate();
  const lit = useLocation({ select: (location) => litFor(location.pathname) });
  const onSettings = lit === "settings";
  const onUsage = lit === "usage";
  const backToWork = useNavigateToMainApp();
  const searchKeys = useShortcutLabel("commandPalette.toggle");
  const { stage, setStage, setWidth } = useColumnStore();
  const view = useSyncExternalStore(page.subscribe, page.read, page.read);
  const { cells } = useNeeds();
  const shelves = useShelves();
  const environmentId = usePrimaryEnvironmentId();
  const update = useUpdateToTake();
  // Upstream's toggle can hide the column, and Settings has no ⌘Z to undo with.
  const { open } = useSidebar();
  useRailUndoNotice(open && lit !== "settings" && lit !== "disk");

  // oxlint-disable-next-line t3code/react-effect-budget -- Mark the document root with the Cells column while it is mounted.
  useLayoutEffect(() => {
    const root = document.documentElement;
    root.dataset.stemcellsColumn = "cells";
    return () => {
      delete root.dataset.stemcellsColumn;
    };
  }, []);

  const standing = (of: CellStanding["stage"]) => (cells ?? []).filter((cell) => cell.stage === of);
  const toRef = (cell: CellStanding): Ref | null =>
    environmentId === null ? null : { environmentId, threadId: cell.threadId };
  const working = standing("working");
  const landed = standing("done");
  const waiting = view.shown.filter((each) => each.goneAt === null).length;
  const counts: Record<ColumnStage, number> = {
    needs: waiting,
    working: working.length,
    landed: landed.length,
    settled: shelves.settled.length,
    pinned: shelves.pinned.length,
  };
  const threads = (list: ReadonlyArray<{ threadId: string }>) =>
    [...new Set(list.map((each) => each.threadId))].slice(0, MINIS);
  const minis: Record<ColumnStage, ReadonlyArray<string>> = {
    needs: threads(view.shown.filter((each) => each.goneAt === null).map((each) => each.need)),
    working: threads(working),
    landed: threads(landed),
    settled: threads(shelves.settled),
    pinned: threads(shelves.pinned),
  };

  return (
    <div data-stemcells-cells="">
      {/* Upstream's sidebar button, or the window's controls, stand here. */}
      <div data-stemcells-rail-titlebar="" className={cn(isElectron && "drag-region")} />
      <div data-cells-top="">
        <button type="button" data-cells-search="" onClick={openSearch}>
          <SearchIcon aria-hidden />
          <span>Search</span>
          {searchKeys ? <kbd>{searchKeys}</kbd> : null}
        </button>
        <RailButton
          label="New Cell"
          detail="⌘T"
          onClick={() => {
            if (!openNewCellPane()) void navigate({ to: "/" });
          }}
        >
          <SquarePenIcon />
        </RailButton>
      </div>
      <div data-cells-list="" data-stage={stage}>
        {stage === "needs" ? <NeedsHere waiting={waiting} /> : null}
        {stage === "working" ? (
          <Rows label="Working" cells={working.flatMap((cell) => rowOf(cell, toRef))} settles />
        ) : null}
        {stage === "landed" ? (
          <Landed cells={landed.flatMap((cell) => rowOf(cell, toRef))} />
        ) : null}
        {stage === "settled" ? (
          <Rows
            label="Settled"
            cells={shelves.settled.slice(0, SETTLED_SHOWN).map(rowOfShelved)}
            more={
              shelves.settled.length > SETTLED_SHOWN ? (
                <button type="button" data-cells-more="" onClick={openSearch}>
                  {shelves.settled.length - SETTLED_SHOWN} more · search finds them
                </button>
              ) : null
            }
          />
        ) : null}
        {stage === "pinned" ? (
          <Rows label="Pinned" cells={shelves.pinned.map(rowOfShelved)} />
        ) : null}
      </div>
      <nav data-cells-stages="" aria-label="Stages">
        {(["needs", "working", "landed", "settled"] as const).map((each) => (
          <StageRow
            key={each}
            stage={each}
            count={counts[each]}
            minis={minis[each]}
            environmentId={environmentId}
            open={stage === each}
            onOpen={() => setStage(each)}
          />
        ))}
        <div data-cells-apart="" />
        <StageRow
          stage="pinned"
          count={counts.pinned}
          minis={minis.pinned}
          environmentId={environmentId}
          open={stage === "pinned"}
          onOpen={() => setStage("pinned")}
        />
      </nav>
      <Hops
        standings={cells === null ? NO_STANDINGS : standingsOf(cells, shelves.settled)}
        environmentId={environmentId}
      />
      {update ? <UpdateBanner update={update} /> : null}
      <div data-cells-foot="">
        {/* Beside the banner the pill would say the same update twice; without
            one, it stays for its checks and Update Everything. */}
        {update ? null : (
          <ul data-stemcells-rail-update="">
            <SidebarUpdatePill />
          </ul>
        )}
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
        <span data-cells-foot-gap="" />
        <RailButton label="All chats, by project" onClick={() => setWidth("list")}>
          <ListIcon />
        </RailButton>
        <RailButton label="Narrow the column" onClick={() => setWidth("rail")}>
          <ChevronsLeftIcon />
        </RailButton>
      </div>
    </div>
  );
}

interface Row {
  readonly cell: Ref;
  readonly title: string;
  readonly line: string | null;
}

const rowOf = (cell: CellStanding, toRef: (cell: CellStanding) => Ref | null): Row[] => {
  const ref = toRef(cell);
  return ref === null ? [] : [{ cell: ref, title: cell.title, line: cell.line }];
};

const rowOfShelved = (cell: ShelvedCell): Row => ({
  cell: { environmentId: cell.environmentId, threadId: cell.threadId },
  title: cell.title,
  line: null,
});

/** A stage's row at the foot: its name and how many are there; the open one is lit. */
function StageRow(props: {
  stage: ColumnStage;
  count: number;
  /** A few of its Cells' threads, the newest first. */
  minis: ReadonlyArray<string>;
  environmentId: string | null;
  open: boolean;
  onOpen: () => void;
}) {
  const { environmentId } = props;
  return (
    <button
      type="button"
      data-cells-stage={props.stage}
      data-open={props.open ? "true" : "false"}
      data-empty={props.count === 0 ? "true" : "false"}
      aria-pressed={props.open}
      onClick={props.onOpen}
    >
      <span data-cells-stage-label="">{LABEL[props.stage]}</span>
      {/* Where a hop lands (Hops.tsx), so it's there with no Cells too. */}
      <span data-cells-stage-minis="" aria-hidden>
        {environmentId === null
          ? null
          : props.minis.map((threadId) => (
              <span key={threadId} data-cells-mini={threadId}>
                <CellMini environmentId={environmentId} threadId={threadId} />
              </span>
            ))}
      </span>
      <span data-cells-stage-count="">{props.count}</span>
    </button>
  );
}

/**
 * What needs you: the cards, held still while you're among them, and ⌘Z
 * taking back the last answer meanwhile. The cards live here while the
 * column shows, and Aski's room shows the chat alone (`NeedsFrame`).
 */
function NeedsHere(props: { waiting: number }) {
  const view = useSyncExternalStore(page.subscribe, page.read, page.read);
  const [pointerIn, setPointerIn] = useState(false);
  const [focusIn, setFocusIn] = useState(false);
  const onPerson = (pointer: boolean | null, focus: boolean | null) => {
    if (pointer !== null) setPointerIn(pointer);
    if (focus !== null) setFocusIn(focus);
  };
  const held = pointerIn || focusIn;
  // oxlint-disable-next-line t3code/react-effect-budget -- Hold the needs page's cards still while the pointer or focus is among them, releasing on unmount.
  useEffect(() => {
    page.setFrozen(held);
    return () => page.setFrozen(false);
  }, [held]);
  useUndoKey(held);
  // A peek shows only in Aski's room; from here the chat opens where a Cell lands.
  const open = useOpenFromNeeds();
  return (
    <CardList
      view={view}
      onPerson={onPerson}
      openChat={open.chat}
      queue
      head={
        props.waiting === 0 && view.cleared === null ? (
          <div data-cells-calm="">
            <b>Nothing needs you.</b>
            <span>You’ll hear the moment a Cell does, here and on your phone.</span>
          </div>
        ) : view.live ? null : (
          <div data-needs-head="">
            <span data-needs-still="">Reconnecting…</span>
          </div>
        )
      }
    />
  );
}

/** A stage's Cells; `settles` gives each a Settle, which stops one at work first (`upstream/settle.ts`). */
function Rows(props: {
  label: string;
  cells: ReadonlyArray<Row>;
  more?: ReactNode;
  settles?: boolean;
}) {
  const settle = useSettleCell();
  return (
    <ol data-cells-rows="" aria-label={props.label}>
      {props.cells.map((row) => (
        <CellRow
          key={row.cell.threadId}
          row={row}
          {...(props.settles ? { onSettle: () => void settle(row.cell) } : {})}
        />
      ))}
      {props.cells.length === 0 ? <li data-cells-none="">None</li> : null}
      {props.more ? <li>{props.more}</li> : null}
    </ol>
  );
}

/** The Cells that say they're done: each settles on its own, or all at once. */
function Landed(props: { cells: ReadonlyArray<Row> }) {
  const settle = useSettleCell();
  if (props.cells.length === 0) return <p data-cells-none="">Nothing waits to be settled.</p>;
  return (
    <>
      <div data-cells-head="">
        <span>Close one and it settles</span>
        {props.cells.length > 1 ? (
          <button
            type="button"
            onClick={() => {
              for (const row of props.cells) void settle(row.cell);
            }}
          >
            Settle all
          </button>
        ) : null}
      </div>
      <ol data-cells-rows="" aria-label="Landed">
        {props.cells.map((row) => (
          <CellRow key={row.cell.threadId} row={row} onSettle={() => void settle(row.cell)} />
        ))}
      </ol>
    </>
  );
}

/** One Cell: its sprite on its own line with its title and project, then its own word, the column's full width. */
function CellRow(props: { row: Row; onSettle?: () => void }) {
  const { row } = props;
  const open = useOpenCell();
  const ref = { ...row.cell, draftId: null };
  const place = useCellPlace(ref);
  return (
    <li data-cells-row="" data-cells-thread={row.cell.threadId}>
      <button type="button" data-cells-open="" onClick={() => open(row.cell)}>
        <span data-cells-row-who="">
          <CellMark cell={ref} />
          <span data-cells-row-title="">{row.title}</span>
          {place?.isProject ? <span data-cells-row-place="">{place.name}</span> : null}
        </span>
        {row.line ? <span data-cells-row-line="">{row.line}</span> : null}
      </button>
      {props.onSettle ? (
        <button type="button" data-cells-settle="" onClick={props.onSettle}>
          Settle
        </button>
      ) : null}
    </li>
  );
}
