/* oxlint-disable shadcn/no-unknown-classes -- Stemcells' classes live in its own stylesheet (composer-line.css), outside upstream's Tailwind entry. */
import { CheckIcon, CornerLeftUpIcon, FolderGit2Icon } from "lucide-react";
import { type CSSProperties, use, useLayoutEffect } from "react";

import { POINTS_PER_PIXEL } from "../cell/look";
import { cellNameOf } from "../cell/name";
import { useCellStage } from "../needs/stream";
import { RenameField } from "../rename/RenameField";
import { CellMark } from "../tabs/CellMark";
import { PaneCellContext, PaneComposerContext } from "../tabs/paneCell";
import {
  EnvironmentMachineIcon,
  ProjectFavicon,
  useCellParent,
  useCellProject,
  useCellRunsOn,
  useCellThreadMenu,
} from "../upstream/chatHeader";
import { useNavigateToCell } from "../upstream/routes";
import { useCellBranch } from "../upstream/checkout";
import { useSettleCell } from "../upstream/settle";
import { useCellPlace } from "../upstream/thread";
import { cn, ComposerBanner, Tooltip, TooltipPopup, TooltipTrigger } from "../upstream/ui";
import { startChatCarry } from "../windows/ChatCarry";
import { useCellAway } from "../windows/CellThrow";
import { LineEnv } from "./LineEnv";
import { oneLinerOf } from "./oneLiner";
import { ComposerEnvSlot, ComposerRoofSlot, ComposerStashSlot } from "./slot";
import { CELL_STANDS_IN } from "./stand";
import "../tokens/stemcells.css";
import "./composer-line.css";

/**
 * The ledge over a Cell's composer, upstream's tab made solid (`composer-line.css`): the Cell
 * stands on it over its name (`stand.ts`), then project, branch (`LineEnv.tsx`), parent and
 * one-liner, with the stash at its right end. A pane has no header, so the line does its jobs.
 * As the pane narrows, words become marks and then go; the name never does.
 */
export function CellComposerLine() {
  const cell = use(PaneCellContext);
  useTellComposerDrawn();
  const menu = useCellThreadMenu(cell);
  const place = useCellPlace(cell);
  const project = useCellProject(cell);
  const parent = useCellParent(cell);
  const runsOn = useCellRunsOn(cell);
  const navigateToCell = useNavigateToCell();
  // A pane with no Cell may stand something else here: Aski, in Aski's pane.
  const roof = use(ComposerRoofSlot);
  const stash = use(ComposerStashSlot);
  const env = use(ComposerEnvSlot);
  const checkout = useCellBranch(cell);
  const away = useCellAway(cell?.threadId);
  const stage = useCellStage(cell?.draftId === null ? cell.threadId : null);
  const settle = useSettleCell();
  const offered = env?.offered === true;
  // Where the menu offers a choice, a checkout on no branch reads as
  // upstream's picker reads it; elsewhere it names nothing.
  const branch = checkout.branch ?? (offered ? "Select ref" : null);
  const envLine =
    !checkout.knownRepo || branch === null ? null : (
      <LineEnv
        branch={branch}
        offered={offered}
        open={env?.open === true}
        onOpenChange={(open) => env?.setOpen(open)}
        host={(element) => env?.setElement(element)}
      />
    );
  if (cell === null) return roof;
  if (menu.title === null) {
    // A draft still chooses where it runs: its ledge holds only that.
    if (cell.draftId === null || envLine === null || !offered) return null;
    return (
      <div data-stemcells-composer-line="" data-draft="">
        <ComposerBanner.Surface className="composer-line-ledge">
          <div className="composer-line-row flex min-w-0 items-center gap-1.5 text-xs/4">
            {envLine}
            <span ref={stash?.setElement} className="composer-line-stash-slot" />
          </div>
        </ComposerBanner.Surface>
      </div>
    );
  }
  const name = cellNameOf(cell.threadId);
  const line = oneLinerOf(menu.title, place?.isProject ? [name, place.name] : [name]);
  const titleProps = {
    type: "button",
    "aria-haspopup": "menu",
    onClick: menu.onClick,
    onDoubleClick: menu.onDoubleClick,
    onBlur: menu.onBlur,
  } as const;
  return (
    <div data-stemcells-composer-line="" data-stage={stage ?? undefined}>
      <div
        className="composer-line-roof pointer-events-none text-foreground"
        style={{ "--cell-stands-in": `${CELL_STANDS_IN}px` } as CSSProperties}
      >
        {/* The Cell is the chat's handle: carried, the chat goes with it. */}
        <span
          data-stemcells-chat-handle=""
          data-away={away || undefined}
          className="flex w-fit"
          onPointerDown={(event) => startChatCarry(event, cell, "cell")}
        >
          <CellMark cell={cell} points={POINTS_PER_PIXEL} stage />
        </span>
      </div>
      <ComposerBanner.Surface className="composer-line-ledge">
        <div
          className="composer-line-row flex min-w-0 items-center gap-1.5 text-xs/4"
          onContextMenu={menu.onContextMenu}
        >
          <button {...titleProps} className="composer-line-name" aria-label={`Actions for ${name}`}>
            <span className="composer-line-name-text">{name}</span>
          </button>
          {place && project ? (
            <Tooltip>
              <TooltipTrigger
                render={
                  <button
                    type="button"
                    className={cn(
                      "composer-line-project composer-line-act min-w-0 font-medium",
                      place.isProject ? "text-foreground" : "text-muted-foreground",
                    )}
                    aria-label={`New Cell in ${place.name}`}
                    onClick={project.startNewChat}
                  />
                }
              >
                <ProjectFavicon
                  project={project.record}
                  className="composer-line-project-mark size-3.5 shrink-0"
                />
                <span className="composer-line-project-name min-w-0 truncate">{place.name}</span>
              </TooltipTrigger>
              <TooltipPopup side="top">New Cell in {place.name}</TooltipPopup>
            </Tooltip>
          ) : null}
          {envLine}
          {runsOn ? (
            <Tooltip>
              <TooltipTrigger
                render={<span className="composer-line-runs-on text-muted-foreground" />}
              >
                {runsOn.machine ? (
                  <EnvironmentMachineIcon kind={runsOn.machine.kind} aria-hidden />
                ) : null}
                {runsOn.worktree ? <FolderGit2Icon aria-hidden /> : null}
              </TooltipTrigger>
              <TooltipPopup side="top">
                {[
                  runsOn.machine?.label,
                  runsOn.worktree &&
                    [runsOn.worktree.label, runsOn.worktree.branch].filter(Boolean).join(" · "),
                ]
                  .filter(Boolean)
                  .join(", ")}
              </TooltipPopup>
            </Tooltip>
          ) : null}
          {parent ? (
            <Tooltip>
              <TooltipTrigger
                render={
                  <button
                    type="button"
                    className="composer-line-parent composer-line-act text-muted-foreground"
                    aria-label={`Open ${parent.title}`}
                    onClick={() => navigateToCell(parent.cell)}
                  />
                }
              >
                <CornerLeftUpIcon aria-hidden />
              </TooltipTrigger>
              <TooltipPopup side="top">{parent.title}</TooltipPopup>
            </Tooltip>
          ) : null}
          {menu.renaming ? (
            <RenameField
              value={menu.title}
              label="Title"
              className="composer-line-rename flex-[1_1_0]"
              onCommit={menu.commitRename}
              onCancel={menu.cancelRename}
            />
          ) : line ? (
            <Tooltip>
              <TooltipTrigger
                render={
                  <button
                    {...titleProps}
                    className="composer-line-one-liner composer-line-act min-w-0 flex-[1_1_0] truncate text-start text-muted-foreground"
                    aria-label={`Actions for ${menu.title}`}
                  />
                }
              >
                {line}
              </TooltipTrigger>
              <TooltipPopup side="top">{line}</TooltipPopup>
            </Tooltip>
          ) : null}
          {stage === "done" ? (
            <button
              type="button"
              className="composer-line-settle composer-line-act"
              aria-label={`Settle ${name}`}
              onClick={() => void settle(cell)}
            >
              <CheckIcon aria-hidden />
              <span>Settle</span>
            </button>
          ) : null}
          <span ref={stash?.setElement} className="composer-line-stash-slot" />
        </div>
      </ComposerBanner.Surface>
    </div>
  );
}

/** The line stands over a composer: drawn, it tells its pane one is (`PaneComposerContext`). */
function useTellComposerDrawn() {
  const tell = use(PaneComposerContext);
  // oxlint-disable-next-line t3code/react-effect-budget -- Tell the pane a composer line is drawn before paint, and take it back on unmount.
  useLayoutEffect(() => {
    if (tell === null) return;
    tell(true);
    return () => tell(false);
  }, [tell]);
}
