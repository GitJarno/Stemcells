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
    // The command goes in as a variable: "Scan the code from Settings › Your devices in …".
    within('command: "t3 pair",', "t3 pair", "Settings › Your devices"),
    within(
      '"Scan the code from {command} or desktop Connections settings"',
      "or desktop Connections settings",
      `in ${APP_NAME} on your computer`,
    ),
  ),
  ...inFile(
    `${PHONE}/home/HomeScreen.tsx`,
    within(`gt('No threads matching "{query}".'`, "threads", CELL.many),
  ),
  ...inFile(
    `${PHONE}/home/ThreadUndoNotice.tsx`,
    within('gt("Settled thread")', "thread", `1 ${CELL.one}`),
    within('gt("Snoozed thread")', "thread", `1 ${CELL.one}`),
    within('gt("Unpinned thread")', "thread", `1 ${CELL.one}`),
  ),
  ...inFile(
    `${PHONE}/layout/workspace/WorkspaceToolbar.tsx`,
    within('threads: msg("Search threads"),', "Search threads", `Search ${CELL.many}`),
  ),
  ...inFile(
    `${PHONE}/threads/NewTaskDraftRouteScreen.tsx`,
    within('<AppBar title={gt("New thread")}', "thread", CELL.one),
  ),
  ...inFile(
    `${PHONE}/threads/NewTaskDraftScreen.tsx`,
    within('? gt("Starting the thread…")', "thread", CELL.one),
    whole("What should we work on?", CASUAL_CHAT.headline),
    within('<AppBar title={gt("New thread")}', "thread", CELL.one),
  ),
  ...inFile(
    `${PHONE}/threads/NewTaskRouteScreen.tsx`,
    within('title={gt("No project")}', "No project", CASUAL_CHAT.title),
    within('accessibilityLabel={gt("No project")}', "No project", CASUAL_CHAT.title),
    within("<T>No project</T>", "No project", CASUAL_CHAT.title),
    // The iOS row's subtitle and Android's line under its title.
    whole("Start a task without a project", CASUAL_CHAT.detail, 2),
    within(
      'label={gt("Start without a project")}',
      "Start without a project",
      CASUAL_CHAT.start,
      2,
    ),
  ),
  ...inFile(
    `${PHONE}/threads/ProviderSubagentBar.tsx`,
    within('"{modelDescription} subagent, {statusLabel}.', "subagent", SUBCELL.one),
  ),
  ...inFile(
    `${PHONE}/threads/SubagentStopButton.tsx`,
    within('"Could not stop agent"', "agent", SUBCELL.one),
    within('gt("Stopping agent {label}"', "agent", SUBCELL.one),
    within('gt("Stop agent {label}"', "agent", SUBCELL.one),
    within('"Stop agent?"', "agent", SUBCELL.one),
    within('"Every running agent in {label} stops."', "agent", SUBCELL.one),
  ),
  ...inFile(
    `${PHONE}/threads/ThreadAgentsSheet.tsx`,
    within("No agents in this turn.", "agents", SUBCELL.many),
    within('<SheetHeader title={gt("Agents")}', "Agents", SUBCELL.many),
    within('"Provider-managed agent. Its work appears in the transcript."', "agent", SUBCELL.one),
    within(`accessibilityHint={gt("Opens this agent's thread")}`, OPENS_AGENT, SUBCELL.one),
  ),
  ...inFile(
    `${PHONE}/threads/ThreadBackgroundWorkSheet.tsx`,
    within('subagent: msg("Subagent"),', "Subagent", SUBCELL.one),
    within('gt("Open subagent {label}"', "subagent", SUBCELL.one),
  ),
  ...inFile(
    `${PHONE}/threads/ThreadFeed.tsx`,
    // The live timer at the end of a turn's fold.
    within('gt("Working for {duration}"', "Working", FLYING),
  ),
  ...inFile(
    `${PHONE}/threads/ThreadRouteScreen.tsx`,
    within('message={gt("Opening thread…")}', "thread", CELL.one),
    within('title={gt("Thread unavailable")}', "Thread", CELL.one),
    within(
      'detail={gt("This thread is not available in the current mobile snapshot.")}',
      "thread",
      CELL.one,
    ),
    within('gt("Subagent of {title}"', "Subagent", SUBCELL.one),
  ),
  ...inFile(
    `${PHONE}/threads/ThreadWorkflowGroup.tsx`,
    within("No agents yet", "agents", SUBCELL.many),
    within(`"Opens this agent's thread"`, OPENS_AGENT, SUBCELL.one),
  ),
  ...inFile(
    `${PHONE}/threads/floating-working-control.tsx`,
    within('gt("Open agents, {agents}"', "Open agents", `Open ${SUBCELL.many}`),
    within(`accessibilityHint={gt("Opens this turn's subagents")}`, "subagents", SUBCELL.many),
  ),
  ...inFile(
    `${PHONE}/threads/thread-list-v2-items.tsx`,
    within('title: msg("Wake thread")', "thread", CELL.one),
    within('title: gt("Arrange threads…")', "threads", CELL.many),
    within('title: gt("Copy thread"),', "Copy thread", COPY_CELL.action),
    within('title: gt("Copy thread ID")', "thread ID", COPY_CELL.menuId),
    within('? gt("Opens the thread")', "thread", CELL.one),
  ),
  ...inFile(
    `${PHONE}/threads/thread-subagent-group.tsx`,
    within("one {{count} subagent}", "subagent", SUBCELL.one),
    within("other {{count} subagents}", "subagents", SUBCELL.many),
    within(`? gt("Opens this agent's thread")`, OPENS_AGENT, SUBCELL.one),
    within(': gt("Provider-managed agent")', "agent", SUBCELL.one),
  ),
  ...inFile(
    `${PHONE}/threads/thread-work-log.tsx`,
    within(`? gt("Opens this agent's thread. Long press to copy.")`, OPENS_AGENT, SUBCELL.one),
  ),
  ...inFile(
    `${PHONE}/threads/thread-workflow-opening.tsx`,
    within(`"Opens this agent's thread"`, OPENS_AGENT, SUBCELL.one),
  ),
  ...inFile(
    `${PHONE}/threads/threadAgentsPresentation.ts`,
    within('return resolve(msg("Subagent"));', "Subagent", SUBCELL.one),
    within('msg("Working", { $context: "agent status" })', "Working", FLYING),
    within('? resolve(msg("Agents"))', "Agents", SUBCELL.many),
  ),
  // The web and the phone: the window's title, the list's status and what a screen reader hears.
  ...inFile(
    "packages/client-runtime/src/state/threadActivityAnnouncement.ts",
    within('working: msg("Working"),', "Working", FLYING),
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
    "apps/web/src/components/sidebar/SidebarFolderDrop.tsx",
    within('description: gt("Drop files on a thread to attach them.")', "thread", CELL.one),
  ),
  ...inFile(
    `${CHAT}/ProviderSubagentBar.tsx`,
    within('gt("{model} subagent: {status}"', "subagent", SUBCELL.one),
  ),
  ...inFile(
    `${CHAT}/ThreadLineageWorkflowRow.tsx`,
    within("one {{settled}/{count} agent}", "agent", SUBCELL.one),
    within("other {{settled}/{count} agents}", "agents", SUBCELL.many),
    within("<T>No agents yet</T>", "agents", SUBCELL.many),
  ),
  ...inFile(
    `${CHAT}/ThreadRelationshipsControl.tsx`,
    within('msg("Open subagent in this chat")', "subagent", SUBCELL.one),
    within('msg("Open parent agent in this chat")', "agent", CELL.one),
    within('props.agent.title ?? gt("Subagent")', "Subagent", SUBCELL.one),
    within('gt("Open parent agent on {label}"', "agent", CELL.one),
    within('label: gt("Previous agents")', "agents", SUBCELL.many),
    within('title: gt("Could not stop subagent")', "subagent", SUBCELL.one),
    within('aria-label={gt("Stop subagent {threadTitle}"', "subagent", SUBCELL.one),
    within("<T>Stop subagent</T>", "subagent", SUBCELL.one),
  ),
  ...inFile(
    `${CHAT}/TimelineV2EventRow.tsx`,
    within("one {{count} subagent}", "subagent", SUBCELL.one),
    within("other {{count} subagents}", "subagents", SUBCELL.many),
  ),
  ...inFile(
    `${CHAT}/TimelineWorkEntryRow.tsx`,
    within('aria-label={gt("Open subagent thread")}', "Open subagent thread", SUBCELL.open),
    within("<T>Open subagent</T>", "Open subagent", SUBCELL.open),
  ),
];
