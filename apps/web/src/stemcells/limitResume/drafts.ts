/**
 * Tells this Mac's server which chats have words in a composer here
 * (`POST /api/stemcells/limit-resume/drafts`), so a Cell stopped by a usage limit never carries
 * on over what the person is writing. The whole list goes on each change, and every `everyMs`
 * while non-empty: the server lets a screen's list lapse when it stops hearing.
 */

export const DRAFTS_PATH = "/api/stemcells/limit-resume/drafts";
/** Well within the server's 150 s, even held to once a minute in a hidden window. */
export const DRAFTS_REPORT_EVERY_MS = 20_000;

export interface DraftReportDeps {
  /** The chats with a draft now, sorted. */
  readonly read: () => ReadonlyArray<string>;
  /** Calls back on any draft change; returns how to stop. */
  readonly onChange: (listener: () => void) => () => void;
  readonly post: (threadIds: ReadonlyArray<string>) => Promise<unknown>;
  readonly everyMs?: number;
}

/** Starts reporting; returns how to stop. */
export function startDraftReport(deps: DraftReportDeps): () => void {
  /** The list the server has from us; null before the first report, or after a failed one. */
  let reported: string | null = null;
  const send = (again: boolean) => {
    const threadIds = deps.read();
    const key = threadIds.join("\n");
    if (!again && key === reported) return;
    // Nothing written and nothing reported: nothing to say.
    if (threadIds.length === 0 && reported === null) return;
    reported = key;
    deps.post(threadIds).catch(() => {
      if (reported === key) reported = null;
    });
  };
  const stopListening = deps.onChange(() => send(false));
  const timer = setInterval(() => {
    if (reported !== null && reported !== "") send(true);
    else if (reported === null) send(false);
  }, deps.everyMs ?? DRAFTS_REPORT_EVERY_MS);
  send(false);
  return () => {
    stopListening();
    clearInterval(timer);
  };
}
