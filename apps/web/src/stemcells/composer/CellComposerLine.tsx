/* oxlint-disable shadcn/no-unknown-classes -- Stemcells' classes live in its own stylesheet (composer-line.css), outside upstream's Tailwind entry. */
import { CornerLeftUpIcon, FolderGit2Icon } from "lucide-react";
import { type CSSProperties, type KeyboardEvent, use, useRef } from "react";

import { POINTS_PER_PIXEL } from "../cell/look";
import { cellNameOf } from "../cell/name";
import { CellMark } from "../tabs/CellMark";
import { PaneCellContext } from "../tabs/paneCell";
import {
  EnvironmentMachineIcon,
  ProjectFavicon,
  useCellParent,
  useCellProject,
  useCellRunsOn,
  useCellThreadMenu,
} from "../upstream/chatHeader";
import { useNavigateToCell } from "../upstream/routes";
import { useCellPlace } from "../upstream/thread";
import { cn, ComposerBanner, Tooltip, TooltipPopup, TooltipTrigger } from "../upstream/ui";
import { oneLinerOf } from "./oneLiner";
import "../tokens/stemcells.css";
import "./composer-line.css";

/**
 * The line over a Cell's composer: who, where and on what. The Cell's name
 * in its tone, its project, where it runs when that is news, the chat it
 * came from, and what the chat is about, quiet. The Cell stands on the
 * line's top edge at its left end, past the rounded corner. The line is one
 * of upstream's attached banners, so it stacks with theirs and wears their
 * surface. Nothing until the chat is sent, and nothing outside a Cell's pane.
 *
 * A pane has no header, so the line does the header's jobs, as upstream's
 * did them: the name and the one-liner open the chat's menu and a
 * double-click renames it; the project starts a new chat in it; the parent's
 * mark goes back to the chat this one came from. As the pane narrows, words
 * become marks and then go (`composer-line.css`); the name never does.
 */
export function CellComposerLine() {
  const cell = use(PaneCellContext);
  const menu = useCellThreadMenu(cell);
  const place = useCellPlace(cell);
  const project = useCellProject(cell);
  const parent = useCellParent(cell);
  const runsOn = useCellRunsOn(cell);
  const navigateToCell = useNavigateToCell();
  if (cell === null || menu.title === null) return null;
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
    <ComposerBanner.Attachment data-stemcells-composer-line="">
      <div
        className="composer-line-roof pointer-events-none ps-(--radius-2xl) text-foreground"
        style={{ "--cell": `${POINTS_PER_PIXEL}px` } as CSSProperties}
      >
        <CellMark cell={cell} points={POINTS_PER_PIXEL} />
      </div>
      <ComposerBanner.Root>
        <div className="flex min-w-0 items-center gap-1.5 px-1" onContextMenu={menu.onContextMenu}>
          <button {...titleProps} className="composer-line-name" aria-label={`Actions for ${name}`}>
            {name}
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
              title={menu.title}
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
        </div>
      </ComposerBanner.Root>
    </ComposerBanner.Attachment>
  );
}

/**
 * The chat's title, open for a new one where the one-liner was: Enter or
 * leaving keeps it, Escape doesn't, as in upstream's header. The line sits in
 * the composer's form, so Enter keeps the title rather than sending.
 */
function RenameField(props: {
  title: string;
  onCommit: (title: string) => void;
  onCancel: () => void;
}) {
  const settled = useRef(false);
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.nativeEvent.isComposing || event.keyCode === 229) return;
    if (event.key === "Enter") {
      event.preventDefault();
      settled.current = true;
      props.onCommit(event.currentTarget.value);
    } else if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      settled.current = true;
      props.onCancel();
    }
  };
  return (
    <input
      autoFocus
      aria-label="Title"
      className="composer-line-rename min-w-0 flex-[1_1_0] rounded-sm bg-transparent text-foreground outline-none ring-1 ring-inset ring-ring/50 focus:ring-ring"
      defaultValue={props.title}
      onFocus={(event) => event.currentTarget.select()}
      onKeyDown={onKeyDown}
      onBlur={(event) => {
        if (settled.current) return;
        // Leaving for a button lets the button act, and keeps the old title.
        if (event.relatedTarget instanceof HTMLElement && event.relatedTarget.closest("button")) {
          props.onCancel();
          return;
        }
        props.onCommit(event.currentTarget.value);
      }}
    />
  );
}
