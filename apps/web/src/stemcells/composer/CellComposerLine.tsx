/* oxlint-disable shadcn/no-unknown-classes -- Stemcells' classes live in its own stylesheet (composer-line.css), outside upstream's Tailwind entry. */
import { type CSSProperties, use } from "react";

import { POINTS_PER_PIXEL } from "../cell/look";
import { cellNameOf } from "../cell/name";
import { CellMark } from "../tabs/CellMark";
import { PaneCellContext } from "../tabs/paneCell";
import { useCellPlace, useCellTitle } from "../upstream/thread";
import { cn, ComposerBanner, Tooltip, TooltipPopup, TooltipTrigger } from "../upstream/ui";
import { oneLinerOf } from "./oneLiner";
import "../tokens/stemcells.css";
import "./composer-line.css";

/**
 * The line over a Cell's composer: who, where and on what. The Cell's name
 * in its tone, its project, and what the chat is about, quiet; as the pane
 * narrows the one-liner gives way first, then the project, and the name
 * stays. The Cell stands on the line's top edge at its left end, past the
 * rounded corner. The line is one of upstream's attached banners, so it
 * stacks with theirs and wears their surface. Nothing until the chat is
 * sent, and nothing outside a Cell's pane.
 *
 * A sent thread keeps its project upstream, so the project is plain text:
 * a chevron would promise a menu that isn't there.
 */
export function CellComposerLine() {
  const cell = use(PaneCellContext);
  const title = useCellTitle(cell);
  const place = useCellPlace(cell);
  if (cell === null || title === null) return null;
  const name = cellNameOf(cell.threadId);
  const line = oneLinerOf(title, place?.isProject ? [name, place.name] : [name]);
  return (
    <ComposerBanner.Attachment data-stemcells-composer-line="">
      <div
        className="composer-line-roof pointer-events-none ps-(--radius-2xl) text-foreground"
        style={{ "--cell": `${POINTS_PER_PIXEL}px` } as CSSProperties}
      >
        <CellMark cell={cell} points={POINTS_PER_PIXEL} />
      </div>
      <ComposerBanner.Root>
        <div className="flex min-w-0 items-center gap-1.5 px-1">
          <span className="composer-line-name">{name}</span>
          {place ? (
            <span
              className={cn(
                "min-w-0 truncate font-medium",
                place.isProject ? "text-foreground" : "text-muted-foreground",
              )}
            >
              {place.name}
            </span>
          ) : null}
          {line ? (
            <Tooltip>
              <TooltipTrigger
                render={<span className="min-w-0 flex-[1_1_0] truncate text-muted-foreground" />}
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
