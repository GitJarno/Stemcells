/**
 * Upstream's thread row, in the parts the column's rows draw (`rail/Cells.tsx`): a chat's age,
 * its project's mark and the thread's hover card. The layout is ours; each part
 * is the sidebar's own, so a sync brings its changes.
 */
import { scopeProjectRef } from "@t3tools/client-runtime/environment";
import type { EnvironmentThreadShell } from "@t3tools/client-runtime/state/shell";
import type { EnvironmentId, ProjectId } from "@t3tools/contracts";
import { snoozeWakeLabel } from "@t3tools/client-runtime/state/thread-settled";
import {
  resolveSettledThreadTimestamp,
  resolveThreadActivityTimestamp,
} from "@t3tools/client-runtime/state/thread-sort";
import { GitBranchIcon } from "lucide-react";
import type { ReactElement, ReactNode } from "react";

import { ThreadHoverCard, ThreadHoverCardPopup } from "../../components/ThreadHoverCard";
import { ThreadPullRequestsMiniList } from "../../components/ThreadStatusIndicators";
import { MiddleTruncate } from "../../components/ui/middle-truncate";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../../components/ui/tooltip";
import { useNowMinute } from "../../hooks/useNowMinute";
import { useSupportsMultiplePullRequests } from "../../hooks/useSupportsMultiplePullRequests";
import { useProject, useQuietThreadShell } from "../../state/entities";
import { formatRelativeTimeLabel } from "../../timestampFormat";
import { ProjectMark } from "../project/ProjectMark";
import type { CellRef } from "../tabs/layout";
import { useCellDriver } from "./providers";
import { threadRefOf } from "./routes";
import { isSettingUp, useCellUnseen } from "./status";

export type CellShell = EnvironmentThreadShell;

export function useCellShell(cell: CellRef): CellShell | null {
  return useQuietThreadShell(threadRefOf(cell));
}

/** What an awake row's light reads of its chat: its provider, and whether its last landing is unseen. */
export function useCellLightFacts(cell: CellRef): {
  readonly driver: string | null;
  readonly unseen: boolean;
} {
  return { driver: useCellDriver(cell), unseen: useCellUnseen(cell) };
}

/** "now", "5m", "3h": an age as the sidebar's rows shorten upstream's label. */
export function compactAge(at: string, nowMs: number): string {
  const label = formatRelativeTimeLabel(at, nowMs);
  return label === "just now" ? "now" : label.endsWith(" ago") ? label.slice(0, -4) : label;
}

/** How long until a timed sleep wakes, as upstream's snoozed rows say it: "40m", "3h", "2d". */
export function wakeIn(at: string, nowMs: number): string {
  return snoozeWakeLabel(at, { now: new Date(nowMs).toISOString() });
}

/** What a Cell's age counts from: its latest message or reply, as the sidebar's, or its settle. */
export function cellAgeAt(shell: CellShell, settled: boolean): string | null {
  return settled ? resolveSettledThreadTimestamp(shell) : resolveThreadActivityTimestamp(shell);
}

/** What the row says where upstream's says when: "Setting up" while its worktree is, else its age. */
export function cellWhen(shell: CellShell, settled: boolean, nowMs: number): string | null {
  if (isSettingUp(shell)) return "Setting up";
  const at = cellAgeAt(shell, settled);
  return at === null ? null : compactAge(at, nowMs);
}

export function CellAge(props: { shell: CellShell; settled?: boolean }) {
  const nowMinute = useNowMinute();
  return cellWhen(props.shell, props.settled === true, Date.parse(`${nowMinute}:00.000Z`));
}

function useShellProject(shell: CellShell) {
  return useProject(scopeProjectRef(shell.environmentId, shell.projectId));
}

/** A row's project mark, and the hover card's beside the project's name, in px. */
const ROW_MARK = 18;
const CARD_MARK = 16;

/**
 * The project's icon alone, as a one-line row marks it; none for a chat without a project.
 * `settles` marks it a part of a planned row's line, which settles out of glyphs (`rail/Planned.tsx`).
 */
export function CellProjectMark(props: { shell: CellShell; settles?: boolean }) {
  const { environmentId, projectId } = props.shell;
  return (
    <CellProjectMarkOf
      environmentId={environmentId}
      projectId={projectId}
      settles={props.settles === true}
    />
  );
}

/** A row's project mark by the project's own id: a planned row's, before its chat is known here. */
export function CellProjectMarkOf(props: {
  environmentId: string;
  projectId: string;
  settles: boolean;
}) {
  const project = useProject(
    scopeProjectRef(props.environmentId as EnvironmentId, props.projectId as ProjectId),
  );
  if (project === null || project.isScratch) return null;
  return (
    <span data-cells-row-project="" data-settle={props.settles ? "#" : undefined}>
      <ProjectMark project={project} size={ROW_MARK} />
    </span>
  );
}

/**
 * The thread's hover card around a row, as the sidebar's: the Cell's own word first, then its
 * project, branch and pull requests.
 */
export function CellCard(props: {
  shell: CellShell | null;
  line: string | null;
  /** What a row without a chat says when pointed at: a planned row that waits for the person. */
  note?: string | null;
  trigger: ReactElement;
  children: ReactNode;
}) {
  const { shell } = props;
  return (
    <Tooltip>
      <TooltipTrigger render={props.trigger}>{props.children}</TooltipTrigger>
      {shell !== null ? (
        <CellCardPopup shell={shell} line={props.line} />
      ) : props.note ? (
        <TooltipPopup side="right" align="start" sideOffset={4}>
          {props.note}
        </TooltipPopup>
      ) : null}
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
            <ProjectMark project={project} size={CARD_MARK} />
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
