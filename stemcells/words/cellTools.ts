/**
 * T3's own tools in the words a person reads, where a T3 thread is a Cell.
 * The work log names each call to one from upstream's labels
 * (`packages/shared/src/t3McpToolPresentation.ts`) and sums up a run of
 * them (`packages/client-runtime/src/t3ToolSummary.ts`). The web's and the
 * phone's substitutes for those two modules say it with these instead.
 */

/** A tool's words, in upstream's order: [action, running, completed, detail]. */
export type ToolLabels = readonly [
  action: string,
  running: string,
  completed: string,
  detail: string,
];

/** Each tool whose upstream label names T3 or a thread, by its id. */
export const CELL_TOOL_LABELS: Readonly<Record<string, ToolLabels>> = {
  create_threads: ["Create", "Creating", "Created", "Cells"],
  t3_thread_start: ["Start", "Starting", "Started", "a Cell"],
  t3_thread_launch: ["Launch", "Launching", "Launched", "a Cell in a project"],
  t3_thread_list: ["Look over", "Looking over", "Looked over", "your Cells"],
  t3_thread_read: ["Read", "Reading", "Read", "a Cell"],
  t3_thread_send: ["Message", "Messaging", "Messaged", "a Cell"],
  t3_thread_wait: ["Wait", "Waiting", "Waited", "for a Cell"],
  t3_thread_interrupt: ["Interrupt", "Interrupting", "Requested an interrupt of", "a Cell"],
  t3_thread_configuration: ["Read", "Reading", "Read", "a Cell's settings"],
  t3_thread_configure: ["Set", "Setting", "Set", "a Cell's model"],
  t3_thread_fork: ["Fork", "Forking", "Requested a fork of", "this Cell"],
  t3_thread_merge_back: ["Merge", "Merging", "Requested a merge of", "a Cell's context"],
  t3_thread_search: ["Search", "Searching", "Searched", "your Cells"],
  t3_thread_transfers: ["Read", "Reading", "Read", "a Cell's transfers"],
  t3_thread_organize: ["Organize", "Organizing", "Organized", "a Cell"],
  t3_thread_update: ["Update", "Updating", "Updated", "a Cell's details"],
  t3_worktree_handoff: ["Hand off", "Handing off", "Handed off", "this Cell to a git worktree"],
  t3_worktree_status: ["Get", "Getting", "Got", "this Cell's worktree status"],
};

/** Upstream's definition of tool `toolId`, in our words where upstream's name T3 or a thread. */
export function withCellWords<
  Definition extends { readonly labels: ToolLabels; readonly displayName: string },
>(toolId: string | null, definition: Definition | null): Definition | null {
  if (definition === null || toolId === null || !Object.hasOwn(CELL_TOOL_LABELS, toolId)) {
    return definition;
  }
  const labels = CELL_TOOL_LABELS[toolId]!;
  return { ...definition, labels, displayName: `${labels[0]} ${labels[3]}` };
}

/** A sentence upstream builds about a run of T3's tools, each thread in it a Cell. */
export function inCellWords(sentence: string): string {
  return sentence.replace(/\b[Tt]hread(s?)\b/g, (_thread, plural: string) => `Cell${plural}`);
}
