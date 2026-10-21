/* oxlint-disable shadcn/no-unknown-classes -- Stemcells' classes live in its own stylesheet (composer-line.css), outside upstream's Tailwind entry. */
import { BookmarkIcon } from "lucide-react";

import { cn, Tooltip, TooltipPopup, TooltipTrigger } from "../upstream/ui";

/**
 * The composer's stash at the right end of the Cell's ledge, as upstream's
 * stash tab says it: its mark, "Stash" and the count, never truncated
 * (the word goes where the line's words become marks). It opens upstream's
 * stash menu as upstream's tab does (the menu knows its trigger by
 * `data-prompt-stash-badge`), and the count lights up for a moment when a
 * prompt is stashed, as upstream's does.
 */
export function LineStash(props: {
  count: number;
  menuOpen: boolean;
  pulseKey: number;
  pulsing: boolean;
  onToggleMenu: () => void;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            data-prompt-stash-badge="true"
            aria-label={`Stashed prompts: ${props.count}. Open stash.`}
            aria-expanded={props.menuOpen}
            className={cn(
              "composer-line-stash composer-line-act",
              props.menuOpen && "pointer-events-none",
              props.menuOpen || props.pulsing ? "text-foreground" : "text-muted-foreground",
            )}
            onPointerDown={(event) => event.preventDefault()}
            onClick={props.onToggleMenu}
          />
        }
      >
        <BookmarkIcon aria-hidden />
        <span className="composer-line-stash-word">Stash</span>
        <span
          key={props.pulseKey}
          className={cn(
            "font-medium tabular-nums",
            props.pulsing &&
              "text-primary transition-[opacity,translate] duration-180 ease-out starting:translate-y-0.5 starting:opacity-0 motion-reduce:transition-none",
          )}
        >
          {props.count}
        </span>
      </TooltipTrigger>
      <TooltipPopup side="top">Stash</TooltipPopup>
    </Tooltip>
  );
}
