import { useState } from "react";

import { undoLatestThreadAction, useUndoKeys, useUndoNotice } from "../upstream/undoNotice";
import { cn, InlineButton } from "../upstream/ui";
import { undoNoticeWords } from "./undoNotice";

/**
 * Upstream's undo line above the stages, in our words: the newest act, an answer or a settle,
 * and the keys that take it back (stemcells/tasks/left-column-v3.md, decision 8). Upstream
 * announces it. It sits over the list's foot, as upstream's sits over its shelves, so nothing
 * moves when it comes and goes.
 */
export function UndoLine() {
  const notice = useUndoNotice();
  const keys = useUndoKeys();
  const words = notice ? undoNoticeWords(notice) : null;
  // Keeps the last words while it fades out, then unmounts on transitionend.
  const [shownWords, setShownWords] = useState(words);
  if (words && words !== shownWords) setShownWords(words);
  const text = words ?? shownWords;
  if (!text) return null;
  return (
    <div
      role="group"
      aria-hidden={!words}
      inert={!words}
      data-cells-undo=""
      onTransitionEnd={(event) => {
        if (!words && event.target === event.currentTarget) setShownWords(null);
      }}
      className={cn(
        "flex gap-1 text-2xs leading-6 text-sidebar-muted-foreground transition-opacity duration-200 ease-out starting:opacity-0",
        !words && "opacity-0",
      )}
    >
      <span className="min-w-0 truncate">{text},</span>
      <InlineButton onClick={undoLatestThreadAction}>
        {keys ? `${keys} to undo` : "Undo"}
      </InlineButton>
    </div>
  );
}
