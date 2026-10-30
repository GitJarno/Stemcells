import { useLocation, useNavigate } from "@tanstack/react-router";
import {
  ChartNoAxesColumnIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronsLeftIcon,
  ListIcon,
  PinIcon,
  SearchIcon,
  SettingsIcon,
  SquarePenIcon,
} from "lucide-react";
import { useLayoutEffect, useState, useSyncExternalStore, type ReactNode } from "react";

import { useAskiRoomInFront } from "../aski/inFront";
import { CardList, onListOf } from "../needs/CardList";
import type { Shown } from "../needs/display";
import { useLeaving } from "../needs/leaving";
import { leaving, page, useSettleAtOnce } from "../needs/live";
import { useNeeds } from "../needs/stream";
import { reveal } from "../needs/walk";
import type { CellStanding } from "../needs/wire";
import { CellMark } from "../tabs/CellMark";
import { openNewCellPane } from "../tabs/commands";
import { CellAge, CellCard, CellProject, CellPullRequest, useCellShell } from "../upstream/cellRow";
import { useOpenCell, useSettledKeptBack, useShelves, type ShelvedCell } from "../upstream/column";
import { useOpenFromNeeds, usePrimaryEnvironmentId } from "../upstream/needs";
import {
  isElectron,
  openSearch,
  ProjectFavicon,
  SidebarUpdatePill,
  useRailProjects,
  useShortcutLabel,
  type RailProject,
} from "../upstream/rail";
import { useNavigateToMainApp } from "../upstream/settings";
import {
  cn,
  Menu,
  MenuPopup,
  MenuRadioGroup,
  MenuRadioItem,
  MenuTrigger,
  useSidebar,
} from "../upstream/ui";
import { useColumnStore, type ColumnStage } from "./column";
import { elsewhere, elsewhereWords, shows } from "./filter";
import { Hops } from "./Hops";
import { standingsOf, type Standings } from "./moves";
import { DiskPlate } from "./DiskPlate";
import { litFor } from "./lit";
import { PlanRing } from "./PlanRing";
import { RailButton } from "./RailParts";
import { StagePager } from "./StagePager";
import { useRailUndoNotice } from "./undoNotice";
import { UndoLine } from "./UndoLine";
import { UpdateBanner, useUpdateToTake } from "./UpdateBanner";
import "../tokens/stemcells.css";
import "./rail.css";
import "../needs/needs.css";
import "./cells.css";

const NO_STANDINGS: Standings = new Map();

/** Settled Cells the list shows before search takes over. */
const SETTLED_SHOWN = 30;

const LABEL: Record<ColumnStage, string> = {
  needs: "Input",
  working: "Flying",
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
  const { stage, setStage, setWidth, project: projectKey, setProject } = useColumnStore();
  // The column, where a two-finger swipe turns its stages (StagePager.tsx).
  const [surface, setSurface] = useState<HTMLDivElement | null>(null);
  // The stage a swipe or a click is taking the column to, lit in the rows before it lands.
  const [aim, setAim] = useState<ColumnStage | null>(null);
  const shownStage = aim ?? stage;
  const view = useSyncExternalStore(page.subscribe, page.read, page.read);
  const { cells } = useNeeds();
  const allShelves = useShelves();
  const environmentId = usePrimaryEnvironmentId();
  const projects = useRailProjects();
  // A project that's gone shows every one, as no filter does.
  const project = projects.find((each) => each.key === projectKey) ?? null;
  const here = (cell: { readonly projectId: string }) =>
    project === null || (environmentId !== null && shows(project, environmentId, cell.projectId));
  const shelves = {
    settled: allShelves.settled.filter(here),
    pinned: allShelves.pinned.filter(here),
  };
  // The server sends only its newest settled Cells; Settled counts the rest it keeps back too.
  const keptBack = useSettledKeptBack((projectId) => here({ projectId }));
  const settledCount = shelves.settled.length + keptBack;
  const settledUnlisted = settledCount - Math.min(shelves.settled.length, SETTLED_SHOWN);
  const update = useUpdateToTake();
  // The undo line stands above the stages; with the column hidden, the notice is a toast.
  // Settings and Usage have no ⌘Z to undo with.
  const { open } = useSidebar();
  useRailUndoNotice(!open && lit === null);
  const onList = onListOf(view);
  const settling = useLeaving(leaving);

  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Mark the document root with the Cells column while it is mounted.
  useLayoutEffect(() => {
    const root = document.documentElement;
    root.dataset.stemcellsColumn = "cells";
    return () => {
      delete root.dataset.stemcellsColumn;
    };
  }, []);

  const standing = (of: CellStanding["stage"]) =>
    (cells ?? []).filter((cell) => cell.stage === of && !settling.has(cell.threadId) && here(cell));
  const toRef = (cell: CellStanding): Ref | null =>
    environmentId === null ? null : { environmentId, threadId: cell.threadId };
  const working = standing("working");
  const landed = standing("done");
  // Asks never hide: Input counts every one, and says where those the filter leaves out are.
  const asking = onList.filter((each) => each.goneAt === null);
  const waiting = asking.length;
  const askedElsewhere =
    environmentId === null
      ? null
      : elsewhereWords(
          elsewhere(
            project,
            projects,
            environmentId,
            asking.map((each) => each.need),
          ),
        );
  const counts: Record<ColumnStage, number> = {
    needs: waiting,
    working: working.length,
    landed: landed.length,
    settled: settledCount,
    pinned: shelves.pinned.length,
  };

  return (
    <div ref={setSurface} data-stemcells-cells="">
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
      {projects.length > 1 || project !== null ? (
        <ProjectFilter projects={projects} project={project} onPick={setProject} />
      ) : null}
      <StagePager
        stage={stage}
        onTurn={setStage}
        onAim={setAim}
        surface={surface}
        pages={{
          needs: (
            <NeedsHere
              waiting={waiting}
              waitingHere={asking.filter((each) => here(each.need)).length}
              only={project === null ? undefined : (each) => here(each.need)}
              project={project?.name ?? null}
              elsewhere={askedElsewhere}
              onShowAll={() => setProject(null)}
            />
          ),
          working: (
            <Rows label="Flying" cells={working.flatMap((cell) => rowOf(cell, toRef))} settles />
          ),
          landed: <Landed cells={landed.flatMap((cell) => rowOf(cell, toRef))} />,
          settled: (
            <Rows
              label="Settled"
              settled
              cells={shelves.settled.slice(0, SETTLED_SHOWN).map(rowOfShelved)}
              more={
                settledUnlisted > 0 ? (
                  <button type="button" data-cells-more="" onClick={openSearch}>
                    {settledUnlisted} more · search finds them
                  </button>
                ) : null
              }
            />
          ),
          pinned: <Rows label="Pinned" cells={shelves.pinned.map(rowOfShelved)} />,
        }}
      />
      <nav data-cells-stages="" aria-label="Stages">
        <UndoLine />
        {(["needs", "working", "landed", "settled"] as const).map((each) => (
          <StageRow
            key={each}
            stage={each}
            count={counts[each]}
            open={shownStage === each}
            onOpen={() => setStage(each)}
          />
        ))}
        <div data-cells-apart="" />
        <StageRow
          stage="pinned"
          count={counts.pinned}
          open={shownStage === "pinned"}
          onOpen={() => setStage("pinned")}
        />
      </nav>
      <Hops
        standings={cells === null ? NO_STANDINGS : standingsOf(cells, allShelves.settled)}
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
        <DiskPlate on={lit === "disk"} wide />
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

/** Which project the column shows, quiet until it's pointed at; every one by default. */
function ProjectFilter(props: {
  projects: ReadonlyArray<RailProject>;
  project: RailProject | null;
  onPick: (key: string | null) => void;
}) {
  const { project } = props;
  return (
    <div data-cells-filter="">
      <Menu>
        <MenuTrigger render={<button type="button" data-cells-filter-pick="" />}>
          {project ? <ProjectFavicon project={project.record} className="size-3.5" /> : null}
          <span>{project?.name ?? "All projects"}</span>
          <ChevronDownIcon aria-hidden />
        </MenuTrigger>
        <MenuPopup align="start">
          <MenuRadioGroup
            value={project?.key ?? ALL_PROJECTS}
            onValueChange={(key: string) => props.onPick(key === ALL_PROJECTS ? null : key)}
          >
            <MenuRadioItem value={ALL_PROJECTS} closeOnClick>
              All projects
            </MenuRadioItem>
            {props.projects.map((each) => (
              <MenuRadioItem key={each.key} value={each.key} closeOnClick>
                {each.name}
              </MenuRadioItem>
            ))}
          </MenuRadioGroup>
        </MenuPopup>
      </Menu>
    </div>
  );
}

const ALL_PROJECTS = "";

/**
 * A stage's row at the foot: a label and a count (stemcells/tasks/left-column-v3.md, decision
 * 5), its mark in the stage's colour, as T3 marks a thread's status; the open one is lit.
 */
function StageRow(props: { stage: ColumnStage; count: number; open: boolean; onOpen: () => void }) {
  return (
    <button
      type="button"
      data-cells-stage={props.stage}
      data-open={props.open ? "true" : "false"}
      data-empty={props.count === 0 ? "true" : "false"}
      aria-pressed={props.open}
      onClick={props.onOpen}
    >
      {props.stage === "pinned" ? (
        <PinIcon data-cells-stage-mark="" aria-hidden />
      ) : (
        <span data-cells-stage-mark="" aria-hidden />
      )}
      <span data-cells-stage-label="">{LABEL[props.stage]}</span>
      {/* A hop dives in here (Hops.tsx). */}
      <span data-cells-stage-count="">{props.count}</span>
    </button>
  );
}

/**
 * What needs you: the cards, each folding away the moment it's answered,
 * settled or gone. In front of Aski's room, which shows every ask open, they
 * fold to an index of it (stemcells/tasks/aski-asks.md, decision 8).
 */
function NeedsHere(props: {
  waiting: number;
  waitingHere: number;
  only: ((shown: Shown) => boolean) | undefined;
  /** The project the column shows, when not every one. */
  project: string | null;
  elsewhere: string | null;
  onShowAll: () => void;
}) {
  const view = useSyncExternalStore(page.subscribe, page.read, page.read);
  const index = useAskiRoomInFront();
  // A peek shows only in Aski's room; from here the chat opens where a Cell lands.
  const open = useOpenFromNeeds();
  return (
    <CardList
      view={view}
      openChat={open.chat}
      queue
      reveal={index ? revealInRoom : undefined}
      only={props.only}
      head={
        props.waiting === 0 && view.cleared === null ? (
          <div data-cells-calm="">
            <b>Nothing needs you.</b>
            <span>You’ll hear the moment a Cell does, here and on your phone.</span>
          </div>
        ) : !view.live ? (
          <div data-needs-head="">
            <span data-needs-still="">Reconnecting…</span>
          </div>
        ) : props.project !== null && props.waitingHere === 0 ? (
          <div data-cells-calm="">
            <b>Nothing in {props.project} needs you.</b>
          </div>
        ) : null
      }
      foot={
        props.elsewhere === null ? null : (
          <button type="button" data-cells-elsewhere="" onClick={props.onShowAll}>
            {props.elsewhere}
          </button>
        )
      }
    />
  );
}

/** Lands on an ask in Aski's room; a narrow room shows its asks as a sheet, opened first. */
function revealInRoom(key: string) {
  if (reveal(key)) return;
  page.setSheet(true);
  requestAnimationFrame(() => reveal(key));
}

/** A stage's Cells; `settles` gives each a Settle, which stops one at work first (`upstream/settle.ts`). */
function Rows(props: {
  label: string;
  cells: ReadonlyArray<Row>;
  more?: ReactNode;
  settles?: boolean;
  settled?: boolean;
}) {
  const settle = useSettleAtOnce();
  return (
    <ol data-cells-rows="" aria-label={props.label}>
      {props.cells.map((row) => (
        <CellRow
          key={row.cell.threadId}
          row={row}
          settled={props.settled === true}
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
  const settle = useSettleAtOnce();
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

/**
 * One Cell in two lines, as upstream's rows: its sprite, title and age; under them its project
 * and pull request. Hovering shows the thread's card, and Settle takes the age's place.
 */
function CellRow(props: { row: Row; settled?: boolean; onSettle?: () => void }) {
  const { row, onSettle } = props;
  const open = useOpenCell();
  const ref = { ...row.cell, draftId: null };
  const shell = useCellShell(ref);
  const onOpen = () => open(row.cell);
  return (
    <li data-cells-row="" data-cells-thread={row.cell.threadId}>
      <CellCard
        shell={shell}
        line={row.line}
        trigger={
          <div
            role="button"
            tabIndex={0}
            data-cells-open=""
            onClick={onOpen}
            onKeyDown={(event) => {
              if (event.target !== event.currentTarget) return;
              if (event.key !== "Enter" && event.key !== " ") return;
              event.preventDefault();
              onOpen();
            }}
          />
        }
      >
        <CellMark cell={ref} />
        <span data-cells-row-title="">{row.title}</span>
        <span data-cells-row-end="">
          <span data-cells-row-age="">
            {shell === null ? null : <CellAge shell={shell} settled={props.settled === true} />}
          </span>
          {onSettle ? (
            <button
              type="button"
              aria-label="Settle"
              data-cells-settle=""
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.stopPropagation();
                onSettle();
              }}
            >
              <CheckIcon aria-hidden />
            </button>
          ) : null}
        </span>
        {shell === null ? null : (
          <span data-cells-row-under="">
            <CellProject shell={shell} />
            <CellPullRequest shell={shell} onOpenCell={onOpen} />
          </span>
        )}
      </CellCard>
    </li>
  );
}
