/* oxlint-disable shadcn/no-unknown-classes -- Stemcells' classes live in its own stylesheet (composer-line.css), outside upstream's Tailwind entry. */
import { BookmarkIcon } from "lucide-react";

import { cn, Tooltip, TooltipPopup, TooltipTrigger } from "../upstream/ui";

/**
 * The composer's stash at the right end of the Cell's ledge, as upstream's stash tab says it:
 * mark, "Stash" and the count, never truncated. It opens upstream's stash menu, which knows its
 * trigger by `data-prompt-stash-badge`, and pulses once on a stash with upstream's animations.
 */
export function LineStash(props: {
  count: number;
  menuOpen: boolean;
  /** Bumped per stash; each new key replays the pulse. 0 means never pulsed. */
  pulseKey: number;
  onToggleMenu: () => void;
}) {
  const pulsed = props.pulseKey > 0;
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
              props.menuOpen ? "text-foreground" : "text-muted-foreground",
              // Two identical keyframes, swapped, restart the row's pulse as upstream's tab does.
              pulsed &&
                (props.pulseKey % 2 === 0
                  ? "animate-stash-pulse-row-alt"
                  : "animate-stash-pulse-row"),
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
            pulsed &&
              "animate-stash-pulse-count transition-[opacity,translate] duration-180 ease-out starting:translate-y-0.5 starting:opacity-0 motion-reduce:transition-none",
          )}
        >
          {props.count}
        </span>
      </TooltipTrigger>
      <TooltipPopup side="top">Stash</TooltipPopup>
    </Tooltip>
  );
}
