/**
 * The word table: where upstream's views say thread, subagent or Working, the builds say Cell,
 * Subcell or Flying, and upstream's files keep their text (`stemcells/docs/fork.md`, "The name
 * transform"). A build fails when a file says an entry's words fewer or more times than the
 * entry does (`nameTransform.ts`). Only builds and tests read this file, never an app.
 */
import { CASUAL_CHAT } from "../words/casualChat.ts";
import { CELL, FLYING } from "../words/cells.ts";
import { COPY_CELL } from "../words/copyCell.ts";
import { SUBCELL } from "../words/subcells.ts";
import { APP_NAME } from "./name.ts";

export interface Swap {
  /** Upstream's file, relative to the repository. */
  readonly file: string;
  /** Upstream's exact text, on one line: enough of it that only this place says it. */
  readonly words: string;
  /** The part of `words` that changes, said once in them. */
  readonly theirs: string;
  /** What stands in its place: words a person reads, never code. */
  readonly ours: string;
  /** How many times the file says `words`. */
  readonly times: number;
}

type InFile = Omit<Swap, "file">;

/** Where upstream says `words`, `ours` stands for the `theirs` in them. */
const within = (words: string, theirs: string, ours: string, times = 1): InFile => ({
  words,
  theirs,
  ours,
  times,
});

/** Where upstream says `words`, `ours` stands for all of them. */
const whole = (words: string, ours: string, times = 1): InFile => within(words, words, ours, times);

const inFile = (file: string, ...swaps: ReadonlyArray<InFile>): Swap[] =>
  swaps.map((swap) => ({ file, ...swap }));

const PHONE = "apps/mobile/src/features";
const CHAT = "apps/web/src/components/chat";

const OPENS_AGENT = "agent's thread";

export const WORD_TABLE: ReadonlyArray<Swap> = [
  // The phone.
  ...inFile(
    `${PHONE}/connection/ConnectionsNewRouteScreen.tsx`,
    within(
      "Scan the code from t3 pair or desktop Connections settings",
      "t3 pair or desktop Connections settings",
      `Settings › Your devices in ${APP_NAME} on your computer`,
    ),
  ),
  ...inFile(
    `${PHONE}/home/HomeScreen.tsx`,
    within('`No threads matching "${props.searchQuery}".`', "threads", CELL.many),
  ),
  ...inFile(
    `${PHONE}/home/ThreadUndoNotice.tsx`,
    within("`${notice.action} thread`", "thread", `1 ${CELL.one}`),
  ),
  ...inFile(
    `${PHONE}/layout/workspace/WorkspaceToolbar.tsx`,
    within('threads: "Search threads",', "Search threads", `Search ${CELL.many}`),
  ),
  ...inFile(
    `${PHONE}/threads/NewTaskDraftRouteScreen.tsx`,
    within('<AppBar title="New thread"', "thread", CELL.one),
  ),
  ...inFile(
    `${PHONE}/threads/NewTaskDraftScreen.tsx`,
    within('? "Starting the thread…"', "thread", CELL.one),
    whole("What should we work on?", CASUAL_CHAT.headline),
    within('<AppBar title="New thread"', "thread", CELL.one),
  ),
  ...inFile(
    `${PHONE}/threads/NewTaskRouteScreen.tsx`,
    within('title="No project"', "No project", CASUAL_CHAT.title),
    within('accessibilityLabel="No project"', "No project", CASUAL_CHAT.title),
    within(">No project</Text>", "No project", CASUAL_CHAT.title),
    // The iOS row's subtitle and Android's line under its title.
    whole("Start a task without a project", CASUAL_CHAT.detail, 2),
    within('label="Start without a project"', "Start without a project", CASUAL_CHAT.start, 2),
  ),
  ...inFile(
    `${PHONE}/threads/ProviderSubagentBar.tsx`,
    within("`${modelDescription} subagent, ${statusLabel}.", "subagent", SUBCELL.one),
  ),
  ...inFile(
    `${PHONE}/threads/SubagentStopButton.tsx`,
    within('"Could not stop agent"', "agent", SUBCELL.one),
    within('? "workflow" : "agent"} ${label}', "agent", SUBCELL.one),
    within('"Stop agent?"', "agent", SUBCELL.one),
    within("`Every running agent in ${label} stops.`", "agent", SUBCELL.one),
  ),
  ...inFile(
    `${PHONE}/threads/ThreadAgentsSheet.tsx`,
    within("No agents in this turn.", "agents", SUBCELL.many),
    within('<SheetHeader title="Agents"', "Agents", SUBCELL.many),
    within('"Provider-managed agent. Its work appears in the transcript."', "agent", SUBCELL.one),
    within(`accessibilityHint="Opens this agent's thread"`, OPENS_AGENT, SUBCELL.one),
  ),
  ...inFile(
    `${PHONE}/threads/ThreadBackgroundWorkSheet.tsx`,
    within('subagent: "Subagent",', "Subagent", SUBCELL.one),
    within("`Open subagent ${item.label}`", "subagent", SUBCELL.one),
  ),
  ...inFile(
    `${PHONE}/threads/ThreadRouteScreen.tsx`,
    within('message="Opening thread…"', "thread", CELL.one),
    within('title="Thread unavailable"', "Thread", CELL.one),
    within(
      'detail="This thread is not available in the current mobile snapshot."',
      "thread",
      CELL.one,
    ),
    within("`Subagent of ${delegatedFromThread?.title", "Subagent", SUBCELL.one),
  ),
  ...inFile(
    `${PHONE}/threads/ThreadWorkflowGroup.tsx`,
    within("No agents yet", "agents", SUBCELL.many),
    within(`"Opens this agent's thread"`, OPENS_AGENT, SUBCELL.one),
  ),
  ...inFile(
    `${PHONE}/threads/floating-working-control.tsx`,
    within("`Open agents, ${agents.accessibilityLabel}`", "Open agents", `Open ${SUBCELL.many}`),
    within(`accessibilityHint="Opens this turn's subagents"`, "subagents", SUBCELL.many),
    // The timer over the composer; cut before the function's own "Working".
    within("Working {format", "Working", FLYING),
  ),
  ...inFile(
    `${PHONE}/threads/thread-list-v2-items.tsx`,
    within('title: "Wake thread"', "thread", CELL.one),
    within('title: "Arrange threads…"', "threads", CELL.many),
    within('title: "Copy thread",', "Copy thread", COPY_CELL.action),
    within('title: "Copy thread ID"', "thread ID", COPY_CELL.menuId),
    within('? "Opens the thread"', "thread", CELL.one),
  ),
  ...inFile(
    `${PHONE}/threads/thread-subagent-group.tsx`,
    within("const label = `${agents.length} subagents`;", "subagents", SUBCELL.many),
    within(`? "Opens this agent's thread"`, OPENS_AGENT, SUBCELL.one),
    within(': "Provider-managed agent"', "agent", SUBCELL.one),
  ),
  ...inFile(
    `${PHONE}/threads/thread-work-log.tsx`,
    within(`? "Opens this agent's thread. Long press to copy."`, OPENS_AGENT, SUBCELL.one),
  ),
  ...inFile(
    `${PHONE}/threads/thread-workflow-opening.tsx`,
    within(`"Opens this agent's thread"`, OPENS_AGENT, SUBCELL.one),
  ),
  ...inFile(
    `${PHONE}/threads/threadAgentsPresentation.ts`,
    within('if (prompt.length === 0) return "Subagent";', "Subagent", SUBCELL.one),
    within('return "Working";', "Working", FLYING),
    within('items.length === 0 ? "Agents" : "Other"', "Agents", SUBCELL.many),
  ),
  ...inFile(
    `${PHONE}/threads/worktree-setup-card.tsx`,
    // The card's own line and the header over a worktree's first turn.
    within("`Working for ${elapsed(", "Working", FLYING, 2),
  ),
  // The web.
  ...inFile(
    "apps/web/src/components/NoProjectsHero.tsx",
    whole("Start without a project", CASUAL_CHAT.start),
  ),
  ...inFile(
    `${CHAT}/DraftHeroHeadline.tsx`,
    whole("or start without a project", CASUAL_CHAT.offer),
    whole("What should we work on?", CASUAL_CHAT.headline),
  ),
  ...inFile(
    `${CHAT}/ProviderSubagentBar.tsx`,
    within("`${modelDescription} subagent: ${announcement}`", "subagent", SUBCELL.one),
  ),
  ...inFile(
    `${CHAT}/ThreadLineageWorkflowRow.tsx`,
    within('phase.members.length === 1 ? "agent" :', "agent", SUBCELL.one),
    within(': "agents"}', "agents", SUBCELL.many),
    within(">No agents yet</li>", "agents", SUBCELL.many),
  ),
  ...inFile(
    `${CHAT}/ThreadRelationshipsControl.tsx`,
    within('currentThreadId ? "Subagent" :', "Subagent", SUBCELL.one),
    within(': "Parent agent";', "agent", CELL.one),
    within('props.agent.title ?? "Subagent"', "Subagent", SUBCELL.one),
    within(': "Open parent agent"', "agent", CELL.one),
    within('label: "Previous agents"', "agents", SUBCELL.many),
    within('title: "Could not stop subagent"', "subagent", SUBCELL.one),
    within("aria-label={`Stop subagent ${threadTitle}`}", "subagent", SUBCELL.one),
    within(">Stop subagent</TooltipPopup>", "subagent", SUBCELL.one),
  ),
  ...inFile(
    `${CHAT}/TimelineV2EventRow.tsx`,
    within('members.length === 1 ? "subagent" :', "subagent", SUBCELL.one),
    within(': "subagents"}`;', "subagents", SUBCELL.many),
  ),
  ...inFile(
    `${CHAT}/TimelineWorkEntryRow.tsx`,
    within('aria-label="Open subagent thread"', "Open subagent thread", SUBCELL.open),
    // The button's text, alone on its line: the space keeps it off the label above.
    within(" Open subagent", "Open subagent", SUBCELL.open),
  ),
];
