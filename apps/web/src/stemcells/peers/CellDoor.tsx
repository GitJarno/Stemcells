/* oxlint-disable shadcn/no-unknown-classes -- Stemcells' classes live in its own stylesheet (peers.css), outside upstream's Tailwind entry. */
import type { ReactNode } from "react";

import { Tooltip, TooltipPopup, TooltipTrigger } from "../upstream/ui";

import "./peers.css";

/** Another Cell, named as a token in the Cell tone: a door to its chat. */
export function CellDoor(props: {
  readonly name: string;
  readonly title: string | null | undefined;
  readonly onOpen: () => void;
  readonly children?: ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={<button type="button" className="sc-peer-who" onClick={props.onOpen} />}
      >
        {props.children}
        <span className="sc-peer-name">{props.name}</span>
      </TooltipTrigger>
      <TooltipPopup side="top">
        {props.title ? `Open ${props.name}: ${props.title}` : `Open ${props.name}`}
      </TooltipPopup>
    </Tooltip>
  );
}
