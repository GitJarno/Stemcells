import { useLocation, useNavigate } from "@tanstack/react-router";
import {
  ChartNoAxesColumnIcon,
  ChevronDownIcon,
  ChevronsLeftIcon,
  CircleCheckIcon,
  CircleDashedIcon,
  FolderPlusIcon,
  ListIcon,
  MessageCircleQuestionIcon,
  MoonIcon,
  SearchIcon,
  SettingsIcon,
  ShieldQuestionIcon,
  SquarePenIcon,
  SunIcon,
} from "lucide-react";
import {
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type ReactNode,
} from "react";

import { onListOf } from "../needs/CardList";
import { conditionLineOf } from "../needs/conditionLines";
import { useLeaving } from "../needs/leaving";
import { leaving, page, useSettleAtOnce, useWakeByHand } from "../needs/live";
import { useNeeds } from "../needs/stream";
import type { CellStanding, Condition } from "../needs/wire";
import { toneTokenOf } from "../glow/light";
import { crossing, resweep, sweep } from "../motion/beat";
import { drawnMoonPhase } from "../motion/moon";
import { type Sight, watchSight } from "../motion/sight";
import { ProjectMark } from "../project/ProjectMark";
import { CellMark } from "../tabs/CellMark";
import { openNewCellPane } from "../tabs/commands";
import { reducedMotion } from "../tokens/motion";
import {
  CellAge,
  CellCard,
  CellProjectMark,
  compactAge,
  useCellLightFacts,
  useCellShell,
  wakeIn,
} from "../upstream/cellRow";
import {
  useOpenCell,
  useSettledKeptBack,
  useShelves,
  type AsleepCell,
  type ShelvedCell,
} from "../upstream/column";
import { useNowMinuteMs, usePrimaryEnvironmentId } from "../upstream/needs";
import {
  isElectron,
  openAddProject,
  openSearch,
  SidebarUpdatePill,
  useRailProjects,
  useShortcutLabel,
  type RailProject,
} from "../upstream/rail";
import { useNavigateToMainApp } from "../upstream/settings";
import {
  cn,
  Menu,
  MenuItem,
  MenuPopup,
  MenuRadioGroup,
  MenuRadioItem,
  MenuTrigger,
  useSidebar,
} from "../upstream/ui";
import {
  EMPTY_WORDS,
  SLEEP,
  STAGE_WORDS,
  STATUS_WORDS,
  WAKE,
  wakesWords,
} from "../../../../../stemcells/words/awake.ts";
import {
  byRecent,
  type Launchable,
  ROW_LIGHT,
  rowStateOf,
  type RowState,
  type RowStatus,
  rowStatusOf,
} from "./awake";
import { useColumnStore, type ColumnStage } from "./column";
import { shows } from "./filter";
import { Hops } from "./Hops";
import { standingsOf, type Standings } from "./moves";
import { DiskPlate } from "./DiskPlate";
import { litFor } from "./lit";
import { PlanRing } from "./PlanRing";
import { RailButton } from "./RailParts";
import { ProxyTrack } from "../tabs/ProxyTrack";
import { useRowMotion } from "./rowMotion";
import { ColumnSky } from "./Sky";
import { StagePager } from "./StagePager";
import { useRailUndoNotice } from "./undoNotice";
import { UndoLine } from "./UndoLine";
import { UnlessBetter, UpdateBanner } from "./UpdateBanner";
import "../tokens/stemcells.css";
import "./rail.css";
import "./cells.css";

const NO_STANDINGS: Standings = new Map();

/** Asleep Cells the list shows before search takes over. */
const ASLEEP_SHOWN = 30;

type Ref = { readonly environmentId: string; readonly threadId: string };

/**
 * The left column as the Cells' line (stemcells/tasks/awake-asleep.md): the Cells awake, open by
 * default, and those asleep, each stage a row at the foot that opens it in its place. An ask is
 * answered in its Cell's chat, and its Awake row wears Input's light. It reads the Cells, never
 * the route, so moving between tabs leaves it as it is.
 */
export function Cells() {
  const navigate = useNavigate();
  const lit = useLocation({ select: (location) => litFor(location.pathname) });
  const onSettings = lit === "settings";
  const onUsage = lit === "usage";
  const backToWork = useNavigateToMainApp();
  const searchKeys = useShortcutLabel("commandPalette.toggle");
  const { stage, setStage, setWidth, project: projectKey, setProject } = useColumnStore();
  // The column: the proxy a two-finger swipe scrolls to turn its stages (StagePager.tsx).
  const [proxy, setProxy] = useState<HTMLDivElement | null>(null);
  // The stage a swipe or a click is taking the column to, lit in the rows before it lands.
  const [aim, setAim] = useState<ColumnStage | null>(null);
  const shownStage = aim ?? stage;
  const view = useSyncExternalStore(page.subscribe, page.read, page.read);
  const { cells, conditions } = useNeeds();
  const shelves = useShelves();
  const environmentId = usePrimaryEnvironmentId();
  const projects = useRailProjects();
  const now = useNowMinuteMs();
  // A project that's gone shows every one, as no filter does.
  const project = projects.find((each) => each.key === projectKey) ?? null;
  const here = (cell: { readonly projectId: string }) =>
    project === null || (environmentId !== null && shows(project, environmentId, cell.projectId));
  const asleep = shelves.asleep.filter(here);
  // The server sends only its newest settled Cells; Asleep counts the rest it keeps back too.
  const keptBack = useSettledKeptBack((projectId) => here({ projectId }));
  const asleepCount = asleep.length + keptBack;
  const asleepUnlisted = asleepCount - Math.min(asleep.length, ASLEEP_SHOWN);
  // The undo line stands above the stages; with the column hidden, the notice is a toast.
  // Settings and Usage have no ⌘Z to undo with.
  const { open } = useSidebar();
  useRailUndoNotice(!open && lit === null);
  const onList = onListOf(view);
  const sleeping = useLeaving(leaving);

  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Mark the document root with the Cells column while it is mounted.
  useLayoutEffect(() => {
    const root = document.documentElement;
    root.dataset.stemcellsColumn = "cells";
    return () => {
      delete root.dataset.stemcellsColumn;
    };
  }, []);

  const asked = askedSince(onList);
  const awake =
    environmentId === null
      ? []
      : awakeOrder((cells ?? []).filter(here), shelves.pinned, shelves.launches, asked).map(
          (cell) => awakeRowOf(cell, environmentId, sleeping.has(cell.threadId), asked),
        );
  const staying = awake.filter((row) => !row.leaving);
  // A Cell a shared stop holds (conditions.md) reads `working` on the wire and isn't flying.
  const held = staying.filter((row) => row.holds !== null);
  // What the stages list, once read: another project is the list read again (`rowMotion.ts`).
  const rowsView =
    cells === null || environmentId === null ? null : `${environmentId}|${projectKey}`;
  const counts: Record<ColumnStage, number> = {
    awake: staying.length,
    asleep: asleepCount,
  };

  return (
    <div ref={setProxy} data-stemcells-cells="" data-stemcells-proxy="">
      <ProxyTrack>
        <ColumnSky stage={shownStage} moonPhase={drawnMoonPhase(now)} />
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
              if (!openNewCellPane(project?.scope ?? null)) void navigate({ to: "/" });
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
          proxy={proxy}
          pages={{
            awake: (
              <>
                {(conditions ?? []).map((condition) => (
                  <Holding
                    key={condition.key}
                    condition={condition}
                    count={held.filter((row) => row.holds === condition.key).length}
                    now={now}
                  />
                ))}
                <Awake rows={awake} now={now} view={rowsView} shown={stage === "awake"} />
              </>
            ),
            asleep: (
              <Asleep
                view={rowsView}
                shown={stage === "asleep"}
                cells={asleep.slice(0, ASLEEP_SHOWN)}
                now={now}
                more={
                  asleepUnlisted > 0 ? (
                    <button type="button" data-cells-more="" onClick={openSearch}>
                      {asleepUnlisted} more · search finds them
                    </button>
                  ) : null
                }
              />
            ),
          }}
        />
        <nav data-cells-stages="" aria-label="Stages">
          <UndoLine />
          {(["awake", "asleep"] as const).map((each) => (
            <StageRow
              key={each}
              stage={each}
              count={counts[each]}
              held={each === "awake" ? held.length : 0}
              open={shownStage === each}
              onOpen={() => setStage(each)}
            />
          ))}
        </nav>
        <Hops
          standings={cells === null ? NO_STANDINGS : standingsOf(cells, shelves.asleep)}
          environmentId={environmentId}
        />
        <UpdateBanner />
        <div data-cells-foot="">
          {/* Beside the banner the pill would say the same updates twice. */}
          <UnlessBetter>
            <ul data-stemcells-rail-update="">
              <SidebarUpdatePill />
            </ul>
          </UnlessBetter>
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
      </ProxyTrack>
    </div>
  );
}

/**
 * Awake's order (stemcells/tasks/awake-asleep.md, decision 1): pins first, as the person set
 * them, then by the time each row shows, latest first.
 */
function awakeOrder(
  cells: ReadonlyArray<CellStanding>,
  pinned: ReadonlyArray<ShelvedCell>,
  launches: ReadonlyMap<string, Launchable>,
  asked: ReadonlyMap<string, string>,
): CellStanding[] {
  const pins = new Map(pinned.map((cell, index) => [cell.threadId, index]));
  const first = cells
    .filter((cell) => pins.has(cell.threadId))
    .toSorted((a, b) => pins.get(a.threadId)! - pins.get(b.threadId)!);
  const rest = byRecent(
    cells
      .filter((cell) => !pins.has(cell.threadId))
      .map((cell) => ({
        ...(launches.get(cell.threadId) ?? { createdAt: cell.createdAt, latestRun: null }),
        id: cell.threadId,
        cell,
      })),
    ({ cell }) => sinceOf(cell, asked),
  );
  return [...first, ...rest.map((each) => each.cell)];
}

/** When each asking Cell began to wait on the person: its oldest ask, by its thread. */
function askedSince(onList: ReturnType<typeof onListOf>): ReadonlyMap<string, string> {
  const since = new Map<string, string>();
  for (const { need } of onList) {
    const threadId = need.parentThreadId ?? need.threadId;
    const before = since.get(threadId);
    if (before === undefined || need.since < before) since.set(threadId, need.since);
  }
  return since;
}

interface AwakeRow {
  readonly cell: Ref;
  readonly title: string;
  readonly line: string | null;
  readonly stage: CellStanding["stage"];
  /** The shared stop that holds it: neither flying nor asking. */
  readonly holds: string | null;
  /** Since when it has been like this: flying, landed, waiting or held. */
  readonly since: string | null;
  /** Going to sleep: it folds away while upstream's settle runs. */
  readonly leaving: boolean;
}

const awakeRowOf = (
  cell: CellStanding,
  environmentId: string,
  leaving: boolean,
  asked: ReadonlyMap<string, string>,
): AwakeRow => ({
  cell: { environmentId, threadId: cell.threadId },
  title: cell.title,
  line: cell.line,
  stage: cell.stage,
  holds: cell.holds ?? null,
  since: sinceOf(cell, asked),
  leaving,
});

/** The time an awake row shows: since it asked, else since its stage began. */
const sinceOf = (cell: CellStanding, asked: ReadonlyMap<string, string>): string | null =>
  cell.stage === "needs-you" ? (asked.get(cell.threadId) ?? null) : (cell.since ?? null);

/**
 * Which project the column shows, quiet until it's pointed at; every one by default. Adding a
 * project starts here too, as upstream's sidebar's project menu does.
 */
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
          {project ? <ProjectMark project={project.record} size={16} /> : null}
          <span>{project?.name ?? "All projects"}</span>
          <ChevronDownIcon aria-hidden />
        </MenuTrigger>
        <MenuPopup align="start">
          <MenuItem onClick={openAddProject}>
            <FolderPlusIcon />
            Add project
          </MenuItem>
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
function StageRow(props: {
  stage: ColumnStage;
  count: number;
  /** Cells of this stage a shared stop holds, among its count. */
  held?: number;
  open: boolean;
  onOpen: () => void;
}) {
  const held = props.held ?? 0;
  return (
    <button
      type="button"
      data-cells-stage={props.stage}
      data-open={props.open ? "true" : "false"}
      data-empty={props.count === 0 ? "true" : "false"}
      aria-pressed={props.open}
      onClick={props.onOpen}
    >
      <span data-cells-stage-mark="" aria-hidden />
      <span data-cells-stage-label="">{STAGE_WORDS[props.stage]}</span>
      {held > 0 ? <span data-cells-stage-held="">{held} holding</span> : null}
      {/* A hop dives in here (Hops.tsx). */}
      <span data-cells-stage-count="">{props.count}</span>
    </button>
  );
}

/** What one shared stop holds, and until when (conditions.md), over Awake's rows it holds. */
function Holding(props: { condition: Condition; count: number; now: number }) {
  if (props.count === 0) return null;
  const line = conditionLineOf(props.condition, props.now);
  return (
    <div data-cells-head="" data-cells-holding="">
      <span>
        Holding {props.count} · {line.what}
      </span>
      <span>{line.when}</span>
    </div>
  );
}

/** Every Cell awake, each with Sleep, which stops one at work first (`upstream/settle.ts`). */
function Awake(props: {
  rows: ReadonlyArray<AwakeRow>;
  now: number;
  view: string | null;
  shown: boolean;
}) {
  const sleep = useSettleAtOnce();
  const list = useRowMotion(
    props.rows.map((row) => row.cell.threadId),
    props.view,
    props.shown,
  );
  if (props.rows.length === 0) return <p data-cells-none="">{EMPTY_WORDS.awake}</p>;
  return (
    <ol ref={list} data-cells-rows="" aria-label={STAGE_WORDS.awake}>
      {props.rows.map((row) => (
        <AwakeCell
          key={row.cell.threadId}
          row={row}
          now={props.now}
          onSleep={() => void sleep(row.cell)}
        />
      ))}
    </ol>
  );
}

/** Every Cell asleep, the latest first, each with Wake. */
function Asleep(props: {
  cells: ReadonlyArray<AsleepCell>;
  now: number;
  more: ReactNode;
  view: string | null;
  shown: boolean;
}) {
  const list = useRowMotion(
    props.cells.map((cell) => cell.threadId),
    props.view,
    props.shown,
  );
  if (props.cells.length === 0 && props.more === null) {
    return <p data-cells-none="">{EMPTY_WORDS.asleep}</p>;
  }
  return (
    <ol ref={list} data-cells-rows="" aria-label={STAGE_WORDS.asleep}>
      {props.cells.map((cell) => (
        <AsleepCellRow key={cell.threadId} cell={cell} now={props.now} />
      ))}
      {props.more ? <li>{props.more}</li> : null}
    </ol>
  );
}

/**
 * An awake Cell on one line: the Cell, its project's mark and its title, and how long it has
 * been like this beside T3's icon for what it does or needs. Behind the Cell a lamp in its
 * provider's tone (stemcells/tasks/awake-asleep.md, decision 3); Sleep takes the time's place.
 */
function AwakeCell(props: { row: AwakeRow; now: number; onSleep: () => void }) {
  const { row } = props;
  const ref = { ...row.cell, draftId: null };
  const { driver, unseen } = useCellLightFacts(ref);
  const state = rowStateOf(row.holds === null ? row.stage : undefined, unseen);
  const tone = toneTokenOf(driver);
  return (
    <CellLine
      cell={row.cell}
      title={row.title}
      line={row.line}
      leaving={row.leaving}
      light={{ state, tone }}
      when={row.since === null ? null : compactAge(row.since, props.now)}
      act={{ label: SLEEP, icon: <MoonIcon aria-hidden />, run: props.onSleep }}
    />
  );
}

function AsleepCellRow(props: { cell: AsleepCell; now: number }) {
  const { cell } = props;
  const wake = useWakeByHand();
  // Off the list at once while the wake runs; back if it fails.
  const [waking, setWaking] = useState(false);
  const ref = { environmentId: cell.environmentId, threadId: cell.threadId };
  return (
    <CellLine
      cell={ref}
      title={cell.title}
      line={null}
      leaving={waking}
      light={null}
      when={
        cell.wakesAt === null
          ? compactAge(cell.since, props.now)
          : wakesWords(`in ${wakeIn(cell.wakesAt, props.now)}`)
      }
      act={{
        label: WAKE,
        icon: <SunIcon aria-hidden />,
        run: () => {
          setWaking(true);
          void wake(ref, cell.wakesAt !== null).then((woke) => {
            if (!woke) setWaking(false);
          });
        },
      }}
    />
  );
}

/**
 * One Cell's line: opens its chat, shows the thread's card on hover, and its act (Sleep or
 * Wake) takes the time's place while pointed at. Leaving, it folds away.
 */
function CellLine(props: {
  cell: Ref;
  title: string;
  line: string | null;
  leaving: boolean;
  light: { readonly state: RowState; readonly tone: string } | null;
  /** How long it has been like this; upstream's age while the stream doesn't say. */
  when: string | null;
  act: { readonly label: string; readonly icon: ReactNode; readonly run: () => void };
}) {
  const open = useOpenCell();
  const ref = { ...props.cell, draftId: null };
  const shell = useCellShell(ref);
  const onOpen = () => open(props.cell);
  const { light } = props;
  const status =
    light === null ? null : rowStatusOf(light.state, shell?.hasPendingApprovals === true);
  return (
    <li
      data-cells-row=""
      data-cells-thread={props.cell.threadId}
      data-leaving={props.leaving ? "" : undefined}
      inert={props.leaving}
    >
      <div data-cells-row-fold="">
        <CellCard
          shell={shell}
          line={props.line}
          trigger={
            <div
              role="button"
              tabIndex={0}
              data-cells-open=""
              data-light={light?.state}
              style={
                light === null
                  ? undefined
                  : ({ "--cells-row-tone": `var(${light.tone})` } as CSSProperties)
              }
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
          {light === null ? null : (
            <span data-cells-light="" aria-hidden>
              <RowBand on={ROW_LIGHT[light.state].band} />
            </span>
          )}
          <CellMark cell={ref} />
          {shell === null ? null : <CellProjectMark shell={shell} />}
          <span data-cells-row-title="">{props.title}</span>
          <span data-cells-row-end="">
            <span
              data-cells-row-age=""
              className={status === null ? undefined : STATUS_ICON[status].className}
            >
              {light === null ? null : <RowStatusIcon status={status} />}
              <span data-cells-row-time="">
                {props.when ??
                  (shell === null ? null : <CellAge shell={shell} settled={light === null} />)}
              </span>
            </span>
            <button
              type="button"
              aria-label={props.act.label}
              data-cells-act=""
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.stopPropagation();
                props.act.run();
              }}
            >
              {props.act.icon}
            </button>
          </span>
        </CellCard>
      </div>
    </li>
  );
}

/** T3's sidebar status icons and their colours (`components/sidebar/SidebarThreadRow.tsx`). */
const STATUS_ICON: Readonly<
  Record<RowStatus, { readonly Icon: typeof CircleDashedIcon; readonly className: string }>
> = {
  working: { Icon: CircleDashedIcon, className: "text-info-foreground" },
  input: { Icon: MessageCircleQuestionIcon, className: "text-indigo-600 dark:text-indigo-300" },
  approval: { Icon: ShieldQuestionIcon, className: "text-warning-foreground" },
  done: { Icon: CircleCheckIcon, className: "text-success-foreground" },
};

/** The icon's place before the time, kept when there is none, so every row's time lines up. */
function RowStatusIcon(props: { status: RowStatus | null }) {
  if (props.status === null) return <span data-cells-row-status="" aria-hidden />;
  const { Icon } = STATUS_ICON[props.status];
  return (
    <span data-cells-row-status="" role="img" aria-label={STATUS_WORDS[props.status]}>
      <Icon aria-hidden />
    </span>
  );
}

/** The band's width, a little wider than a word's sheen: a row is wider than a word. */
const BAND_WIDTH = 48;
/** The composer's lean (`glow/light.ts`): a shear, its top ahead. */
const BAND_LEAN = "skewX(-24deg)";

/**
 * The flying Cell's band, crossing its row on the composer's beat (`motion/beat.ts`), the column
 * standing for the pane it crosses. Only a transform moves; it holds unseen, steps beside
 * another app and stays still with less motion. A landing lets the pass under way finish, so
 * the light comes to rest rather than going out.
 */
function RowBand(props: { on: boolean }) {
  const ref = useRef<HTMLSpanElement>(null);
  const { on } = props;

  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Own the band's crossing and its size, motion and sight watchers while the Cell flies.
  useLayoutEffect(() => {
    const band = ref.current;
    const plate = band?.closest("[data-cells-open]");
    const column = band?.closest("[data-stemcells-cells]");
    if (!on || !band || !plate || !column) return;
    let crossingNow: Animation | null = null;
    let sight: Sight = "focused";
    const aim = () => {
      if (reducedMotion() || sight === "hidden") {
        crossingNow?.cancel();
        crossingNow = null;
        return;
      }
      const pane = column.getBoundingClientRect();
      const left = plate.getBoundingClientRect().left - pane.left;
      const { from, to } = crossing(pane.width, left, BAND_WIDTH / 2);
      const stepped = sight === "unfocused";
      if (crossingNow) resweep(crossingNow, from, to, BAND_LEAN, stepped);
      else crossingNow = sweep(band, from, to, BAND_LEAN, stepped);
    };
    aim();
    // oxlint-disable-next-line t3code/no-raw-resize-observer -- The place goes to the band's animation, never into React state.
    const sized = new ResizeObserver(aim);
    sized.observe(column);
    const motion = matchMedia("(prefers-reduced-motion: reduce)");
    motion.addEventListener("change", aim);
    // The plate, which holds still: the band itself rests off it.
    const unwatch = watchSight(plate, (now) => {
      sight = now;
      aim();
    });
    return () => {
      sized.disconnect();
      motion.removeEventListener("change", aim);
      unwatch();
      const pass = crossingNow?.effect?.getComputedTiming().currentIteration;
      if (typeof pass === "number") crossingNow?.effect?.updateTiming({ iterations: pass + 1 });
      else crossingNow?.cancel();
    };
  }, [on]);

  return <span ref={ref} data-cells-band="" style={{ width: BAND_WIDTH }} />;
}
