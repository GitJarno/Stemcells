import type { ReactElement, ReactNode } from "react";

import { Tooltip, TooltipPopup, TooltipTrigger } from "../upstream/ui";

/**
 * The rail's tooltip: to the right of the item, at once, its name and a
 * second line when there is more to say.
 */
export function RailTip(props: { title: string; detail?: string | null; trigger: ReactElement }) {
  return (
    <Tooltip>
      <TooltipTrigger delay={0} render={props.trigger} />
      <TooltipPopup side="right">
        <div data-stemcells-rail-tip="">
          <div>{props.title}</div>
          {props.detail ? <div data-stemcells-rail-tip-detail="">{props.detail}</div> : null}
        </div>
      </TooltipPopup>
    </Tooltip>
  );
}

/** One of the rail's items: a glyph on a plate, lit when it is where you are. */
export function RailButton(props: {
  label: string;
  detail?: string | null;
  on?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <RailTip
      title={props.label}
      detail={props.detail ?? null}
      trigger={
        <button
          type="button"
          aria-label={props.label}
          aria-current={props.on ? "page" : undefined}
          data-stemcells-rail-plate=""
          data-on={props.on ? "true" : "false"}
          onClick={props.onClick}
        >
          {props.children}
        </button>
      }
    />
  );
}

/** A short rule between the rail's groups. */
export function RailRule() {
  return <div aria-hidden data-stemcells-rail-rule="" />;
}
