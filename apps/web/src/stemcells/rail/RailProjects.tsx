import { askiCellOf, isAskiTab } from "../tabs/askiTab";
import { activeTab, focusedPane } from "../tabs/layout";
import { useWorkspaceStore } from "../tabs/store";
import { useNavigateToCell } from "../upstream/routes";
import {
  ProjectFavicon,
  useCellProjectKey,
  useRailChats,
  useRailProjects,
  type RailProject,
} from "../upstream/rail";
import { useMinute } from "./clock";
import { badgeLetters, railTiles, tileSummary, type RailTile } from "./projects";
import { RailTip } from "./RailParts";

/**
 * A badge for each project with an open chat, in upstream's order. A click
 * opens the project's first chat; the project of the chat you're in is lit.
 */
export function RailProjects() {
  const projects = useRailProjects();
  // Snoozes end on the minute; the rail looks again each minute.
  const chats = useRailChats(new Date(useMinute()).toISOString());
  const aski = useWorkspaceStore((store) => askiCellOf(store.workspace));
  const focused = useWorkspaceStore((store) =>
    isAskiTab(activeTab(store.workspace)) ? null : (focusedPane(store.workspace)?.cell ?? null),
  );
  const focusedProject = useCellProjectKey(focused);
  const navigateToCell = useNavigateToCell();
  const tiles = railTiles(projects, chats, aski);

  return (
    <div data-stemcells-rail-projects="">
      {tiles.map((tile) => (
        <ProjectTile
          key={tile.project.key}
          tile={tile}
          on={focusedProject !== null && tile.project.memberKeys.includes(focusedProject)}
          onOpen={() => navigateToCell(tile.first)}
        />
      ))}
    </div>
  );
}

function ProjectTile(props: { tile: RailTile; on: boolean; onOpen: () => void }) {
  const { project, dot } = props.tile;
  const summary = tileSummary(props.tile);
  return (
    <RailTip
      title={project.name}
      detail={summary}
      trigger={
        <button
          type="button"
          aria-label={summary ? `${project.name}: ${summary}` : project.name}
          aria-current={props.on ? "true" : undefined}
          data-stemcells-rail-plate=""
          data-stemcells-rail-project={project.key}
          data-on={props.on ? "true" : "false"}
          onClick={props.onOpen}
        >
          <ProjectBadge project={project} dot={dot} />
        </button>
      }
    />
  );
}

/**
 * The project's mark on a badge: its letters in its colour, or the icon or
 * emoji chosen for it; an amber dot at the corner while a chat there needs
 * you.
 */
export function ProjectBadge(props: { project: RailProject; dot: RailTile["dot"] }) {
  const { mark, record } = props.project;
  return (
    <span data-stemcells-badge={mark.kind} className={mark.colorClass ?? undefined} aria-hidden>
      {mark.kind === "letters" ? (
        badgeLetters(mark.text)
      ) : (
        <ProjectFavicon project={record} className="size-3.5" />
      )}
      {props.dot ? <span data-stemcells-badge-dot={props.dot} /> : null}
    </span>
  );
}
