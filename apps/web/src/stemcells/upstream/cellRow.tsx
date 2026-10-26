/**
 * Upstream's thread row, in the parts the column's rows draw (`rail/Cells.tsx`): a chat's age,
 * its project, its pull request badge and the thread's hover card. The layout is ours; each part
 * is the sidebar's own, so a sync brings its changes.
 */
import { scopeProjectRef } from "@t3tools/client-runtime/environment";
import type { EnvironmentThreadShell } from "@t3tools/client-runtime/state/shell";
import { resolveSettledThreadTimestamp } from "@t3tools/client-runtime/state/thread-sort";
import { resolveThreadCurrentPullRequestLink } from "@t3tools/client-runtime/thread-pull-requests";
import { GitBranchIcon } from "lucide-react";
import type { MouseEvent, ReactElement, ReactNode } from "react";

import { ProjectFavicon } from "../../components/ProjectFavicon";
import { useRightPanelStore } from "../../rightPanelStore";
import { ThreadHoverCard, ThreadHoverCardPopup } from "../../components/ThreadHoverCard";
import {
  prStatusIndicator,
  resolveThreadPullRequestBadge,
  ThreadPullRequestBadgeControl,
  ThreadPullRequestsMiniList,
  useLinkedThreadPullRequest,
} from "../../components/ThreadStatusIndicators";
import { InlineButton } from "../../components/ui/button";
import { MiddleTruncate } from "../../components/ui/middle-truncate";
import { Tooltip, TooltipTrigger } from "../../components/ui/tooltip";
import { useNowMinute } from "../../hooks/useNowMinute";
import { useSupportsMultiplePullRequests } from "../../hooks/useSupportsMultiplePullRequests";
import { useOpenPrLink } from "../../lib/openPullRequestLink";
import { useProject, useQuietThreadShell } from "../../state/entities";
import { formatRelativeTimeLabel } from "../../timestampFormat";
import type { CellRef } from "../tabs/layout";
import { threadRefOf } from "./routes";

export type CellShell = EnvironmentThreadShell;

export function useCellShell(cell: CellRef): CellShell | null {
  return useQuietThreadShell(threadRefOf(cell));
}

/** "now", "5m", "3h": an age as the sidebar's rows shorten upstream's label. */
export function compactAge(at: string, nowMs: number): string {
  const label = formatRelativeTimeLabel(at, nowMs);
  return label === "just now" ? "now" : label.endsWith(" ago") ? label.slice(0, -4) : label;
}

/** The chat's age: of its last message or, once settled, of the settle. */
export function CellAge(props: { shell: CellShell; settled?: boolean }) {
  const nowMinute = useNowMinute();
  const at = props.settled
    ? resolveSettledThreadTimestamp(props.shell)
    : (props.shell.latestUserMessageAt ?? props.shell.updatedAt);
  return at === null ? null : compactAge(at, Date.parse(`${nowMinute}:00.000Z`));
}

function useShellProject(shell: CellShell) {
  return useProject(scopeProjectRef(shell.environmentId, shell.projectId));
}

/** The project's icon and name, or upstream's words for a chat without one. */
export function CellProject(props: { shell: CellShell }) {
  const project = useShellProject(props.shell);
  if (project === null) return null;
  if (project.isScratch) return <span data-cells-row-project="">No project</span>;
  return (
    <span data-cells-row-project="">
      <ProjectFavicon project={project} className="size-3.5 shrink-0" />
      <span>{project.title}</span>
    </span>
  );
}

/**
 * The chat's pull request as the sidebar shows it: its state's icon and colour, and its number.
 * It opens beside the chat, and a stack opens the chat's list of them.
 */
export function CellPullRequest(props: { shell: CellShell; onOpenCell: () => void }) {
  const { shell, onOpenCell } = props;
  const threadRef = threadRefOf({
    environmentId: shell.environmentId,
    threadId: shell.id,
    draftId: null,
  });
  const linked = useLinkedThreadPullRequest(
    shell.environmentId,
    shell.linkedPullRequest,
    true,
    shell.pullRequests,
    shell.branchPullRequest,
  );
  const multiple = useSupportsMultiplePullRequests(shell.environmentId);
  const openPrLink = useOpenPrLink(threadRef);
  const pr = linked?.pr ?? null;
  const current = multiple ? resolveThreadCurrentPullRequestLink(shell.pullRequests) : null;
  const badge = multiple ? resolveThreadPullRequestBadge(shell.pullRequests) : null;
  if (badge?.kind !== "stack" && pr === null && current === null) return null;
  const openPullRequest = (event: MouseEvent<HTMLElement>, targetUrl?: string) => {
    const url = targetUrl ?? pr?.url ?? current?.url;
    if (url === undefined) return;
    if (openPrLink(event, url, threadRef)) onOpenCell();
  };
  return (
    <ThreadPullRequestBadgeControl
      render={<InlineButton />}
      badge={badge}
      pullRequests={shell.pullRequests}
      number={pr?.number ?? current?.number}
      url={pr?.url ?? current?.url}
      status={prStatusIndicator(pr, linked?.sourceControlProvider)}
      onOpenList={() => {
        useRightPanelStore.getState().open(threadRef, "pull-requests");
        onOpenCell();
      }}
      onOpenPullRequest={openPullRequest}
    />
  );
}

/**
 * The thread's hover card around a row, as the sidebar's: the Cell's own word first, then its
 * project, branch and pull requests.
 */
export function CellCard(props: {
  shell: CellShell | null;
  line: string | null;
  trigger: ReactElement;
  children: ReactNode;
}) {
  const { shell } = props;
  return (
    <Tooltip>
      <TooltipTrigger render={props.trigger}>{props.children}</TooltipTrigger>
      {shell === null ? null : <CellCardPopup shell={shell} line={props.line} />}
    </Tooltip>
  );
}

function CellCardPopup(props: { shell: CellShell; line: string | null }) {
  const { shell } = props;
  const project = useShellProject(shell);
  const multiple = useSupportsMultiplePullRequests(shell.environmentId);
  return (
    <ThreadHoverCardPopup side="right" align="start" sideOffset={4}>
      <ThreadHoverCard
        title={shell.title}
        footer={
          multiple && shell.pullRequests.length > 0 ? (
            <div className="border-t border-border/60 pt-2 pl-0.5 text-xs text-muted-foreground">
              <ThreadPullRequestsMiniList pullRequests={shell.pullRequests} />
            </div>
          ) : null
        }
      >
        {props.line ? <div className="text-foreground/75">{props.line}</div> : null}
        {project !== null && !project.isScratch ? (
          <div className="flex min-w-0 items-center gap-2">
            <ProjectFavicon project={project} className="size-3 shrink-0" />
            <div className="min-w-0 truncate text-foreground/75">{project.title}</div>
          </div>
        ) : null}
        {shell.branch ? (
          <div className="flex min-w-0 items-center gap-2">
            <GitBranchIcon className="size-3 shrink-0 stroke-muted-foreground" />
            <MiddleTruncate value={shell.branch} className="flex" />
          </div>
        ) : null}
      </ThreadHoverCard>
    </ThreadHoverCardPopup>
  );
}
