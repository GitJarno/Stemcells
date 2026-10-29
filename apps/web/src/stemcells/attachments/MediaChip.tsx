import { FilmIcon, ImageIcon } from "lucide-react";

import {
  ContextChip,
  ContextChipLabel,
  Tooltip,
  TooltipPopup,
  TooltipTrigger,
} from "../upstream/attachmentLabels";

/**
 * A picture's or a video's chip in a prompt: its kind's icon and its label ("Image 1"), never its
 * file's name, size or thumbnail. The tile over the prompt shows the picture; the chip only says
 * which one the words point at.
 */
export function MediaChip(props: {
  kind: "image" | "video";
  label: string;
  /** An upload's progress, or its failure. */
  suffix?: string | null;
  /** Why the upload failed, on hover. */
  tooltip?: string | null;
  failed?: boolean;
  disabled?: boolean;
  copyMarkdown?: string;
  onOpen: () => void;
}) {
  const chip = (
    <ContextChip
      kind={props.kind}
      {...(props.failed ? { state: "invalid" as const } : {})}
      render={<button type="button" disabled={props.disabled} />}
      aria-label={[props.label, props.suffix].filter(Boolean).join(", ")}
      data-markdown-copy={props.copyMarkdown}
      onClick={props.onOpen}
    >
      {props.kind === "video" ? <FilmIcon /> : <ImageIcon />}
      <ContextChipLabel className="flex items-baseline gap-[0.33em]">
        <span className="whitespace-nowrap">{props.label}</span>
        {props.suffix ? <span className="text-3xs text-current">{props.suffix}</span> : null}
      </ContextChipLabel>
    </ContextChip>
  );
  if (!props.tooltip) return chip;
  return (
    <Tooltip>
      <TooltipTrigger render={chip} />
      <TooltipPopup side="top" className="whitespace-pre-wrap">
        {props.tooltip}
      </TooltipPopup>
    </Tooltip>
  );
}
