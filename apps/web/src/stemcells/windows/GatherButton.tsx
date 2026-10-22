/**
 * The strip's Gather / Put back button (stemcells/tasks/windows.md, Gather
 * and Put back): there only when it can act, its icon cross-fading between
 * the two on `flick`.
 */
import { Expand, Shrink } from "lucide-react";

import { shortcutLabel } from "../upstream/keys";
import { Button, Tooltip, TooltipPopup, TooltipTrigger } from "../upstream/ui";
import { GATHER_SHORTCUT, gatherOrPutBack, useGatherOffer } from "./gatherWindows";

const flick = (shown: boolean) => ({
  opacity: shown ? 1 : 0,
  transition: "opacity var(--sc-motion-flick-duration) var(--sc-motion-flick-easing)",
});

export function GatherButton(props: { className?: string }) {
  const offer = useGatherOffer();
  if (!offer) return null;
  const label = offer === "gather" ? "Gather windows" : "Put windows back";
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label={label}
            className={props.className}
            onClick={() => void gatherOrPutBack()}
          />
        }
      >
        {/* Both in one cell, so one fades out where the other fades in. */}
        <span className="grid">
          <Shrink className="col-start-1 row-start-1" style={flick(offer === "gather")} />
          <Expand className="col-start-1 row-start-1" style={flick(offer === "putBack")} />
        </span>
      </TooltipTrigger>
      <TooltipPopup>{`${label} (${shortcutLabel(GATHER_SHORTCUT)})`}</TooltipPopup>
    </Tooltip>
  );
}
