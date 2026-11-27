import {
  CircleCheckIcon,
  CircleDashedIcon,
  MessageCircleQuestionIcon,
  ShieldQuestionIcon,
} from "lucide-react";

import { STATUS_WORDS } from "../../../../../stemcells/words/awake.ts";
import { useCellStage } from "../needs/stream";
import type { CellRef } from "../tabs/layout";
import { useCellStatus } from "../upstream/status";
import { cn } from "../upstream/ui";
import type { RowStatus } from "./awake";

/** T3's sidebar status icons and their colours (`components/sidebar/SidebarThreadRow.tsx`). */
export const STATUS_ICON: Readonly<
  Record<RowStatus, { readonly Icon: typeof CircleDashedIcon; readonly className: string }>
> = {
  working: { Icon: CircleDashedIcon, className: "text-info-foreground" },
  input: { Icon: MessageCircleQuestionIcon, className: "text-indigo-600 dark:text-indigo-300" },
  approval: { Icon: ShieldQuestionIcon, className: "text-warning-foreground" },
  done: { Icon: CircleCheckIcon, className: "text-success-foreground" },
};

/** An awake row's icon for `status`, in its colour, named for one who can't see it. */
export function StatusIcon(props: { status: RowStatus }) {
  const { Icon, className } = STATUS_ICON[props.status];
  return (
    <span
      role="img"
      aria-label={STATUS_WORDS[props.status]}
      className={cn("inline-flex size-3 shrink-0 [&>svg]:size-full", className)}
    >
      <Icon aria-hidden />
    </span>
  );
}

/**
 * The row's icon while its Cell asks (Input, or Approval), for a place that draws the Cell with
 * no row beside it: a tab, a pane's ledge or pill. Nothing otherwise.
 */
export function CellAskIcon(props: { cell: CellRef | null }) {
  const { cell } = props;
  const stage = useCellStage(cell?.draftId === null ? cell.threadId : null);
  const approval = useCellStatus(cell) === "Pending Approval";
  if (stage !== "needs-you") return null;
  return <StatusIcon status={approval ? "approval" : "input"} />;
}
