/**
 * What needs the person, as the server sends it (`GET /api/stemcells/needs`
 * and its stream; apps/server/src/stemcells/needs/derive.ts keeps the other
 * copy of these types, and `wire.contract.test.ts` there holds the two together).
 */

export type NeedKind =
  | "permission"
  | "question"
  | "sign-in"
  | "input"
  | "limit"
  | "failed"
  | "plan"
  | "prose"
  | "stuck";

export type RequestKind =
  | "command"
  | "file-read"
  | "file-change"
  | "permission"
  | "mcp-elicitation"
  | "user_input"
  | "auth_refresh"
  | "dynamic_tool_call";

export type ApprovalDecision =
  | "accept"
  | "acceptForSession"
  | "acceptAlways"
  | "decline"
  | "cancel";

export interface AskedQuestion {
  readonly id: string;
  readonly header: string;
  readonly question: string;
  readonly options: ReadonlyArray<{
    readonly label: string;
    readonly description: string;
    readonly value: string | null;
    /** What the option looks like, to see before choosing it. A server from before it sends none. */
    readonly preview?: string | null;
  }>;
  readonly multiSelect: boolean;
  readonly allowCustomAnswer: boolean;
}

export interface NeedRequest {
  readonly id: string;
  readonly kind: RequestKind;
  readonly prompt: string | null;
  readonly appName: string | null;
  /** The provider's own words for why it asks, when it gives them. */
  readonly reason: string | null;
  /** Why it asks although the Cell runs with full access: the person's ask rule, or the provider's own check. */
  readonly fullAccessOverride: "ask_rule" | "provider_check" | null;
  readonly options: ReadonlyArray<{
    readonly decision: ApprovalDecision;
    readonly label: string;
    readonly warning?: string | undefined;
  }>;
  readonly questions: ReadonlyArray<AskedQuestion>;
  readonly responseMode: "message" | null;
  readonly capability: "live" | "message" | "not_resumable" | null;
}

export interface Need {
  readonly key: string;
  readonly number: number;
  readonly kind: NeedKind;
  readonly threadId: string;
  readonly projectId: string;
  readonly parentThreadId: string | null;
  readonly title: string;
  readonly providerInstanceId: string;
  readonly since: string;
  readonly blocks: boolean;
  readonly request: NeedRequest | null;
  readonly plan: {
    readonly id: string | null;
    readonly runId: string;
    readonly title: string | null;
    readonly steps: ReadonlyArray<string>;
    readonly markdown: string | null;
  } | null;
  readonly limit: {
    readonly runId: string;
    readonly resetAt: string | null;
    readonly autoResume: boolean;
  } | null;
  readonly prose: {
    readonly runId: string;
    /**
     * What the pre-read found: a question, an offer to go on, or a stop short
     * of done; or the Cell's own close-out naming a step that is the person's.
     */
    readonly cue: "question" | "offer" | "stopped" | "left";
    /** The reply's last paragraph, word for word; a left's steps read as one. */
    readonly text: string;
    /** A left's steps, each as the Cell wrote it; empty for any other cue. */
    readonly steps: ReadonlyArray<string>;
    /** The Cell's own step that waits on the person's; null when it named none. */
    readonly next: string | null;
    /** The reply's opening paragraph: what the Cell did. */
    readonly lead: string | null;
  } | null;
  readonly stuck: {
    readonly runId: string;
    /** The last time the Cell showed life. */
    readonly quietSince: string;
    /** The tool call it is in the middle of; null with the model itself at work. */
    readonly tool: { readonly title: string | null; readonly command: string | null } | null;
  } | null;
  readonly failure: {
    readonly runId: string;
    readonly errorClass:
      | "usage_limit"
      | "provider_error"
      | "transport_error"
      | "permission_error"
      | "validation_error"
      | "unknown"
      | null;
    readonly message: string | null;
  } | null;
  /** Absent from a server before the brief. */
  readonly brief?: Brief | null;
}

/**
 * What stands beside a Cell's own words (stemcells/tasks/aski-brief.md): what it was told to do
 * and what its run shows, from T3's records.
 */
export interface Brief {
  /** The instruction the Cell is on. */
  readonly goal: string | null;
  /** The files and lines the run changed; null when it changed none. */
  readonly changed: {
    readonly files: number;
    readonly additions: number;
    readonly deletions: number;
  } | null;
  /** Each kind of check the run ran, as it last ended. */
  readonly checks: ReadonlyArray<{
    readonly kind: "test" | "typecheck" | "lint" | "build";
    readonly ok: boolean;
  }>;
  readonly pullRequest: {
    readonly number: number;
    readonly url: string;
    readonly state: "open" | "closed" | "merged";
    readonly draft: boolean;
    readonly checks: "passing" | "failing" | "pending" | null;
    readonly conflicts: boolean;
  } | null;
}

/** How a done Cell landed: shown by a fact, on its word alone, or short. */
export interface Landing {
  readonly verdict: "shown" | "claimed" | "short";
  /** The fact the verdict stands on. */
  readonly proof:
    | "stopped"
    | "rolled-back"
    | "failed"
    | "pr-checks-failing"
    | "check-failed"
    | "pr-merged"
    | "pr-checks-passing"
    | "checks-clean"
    | "word";
}

/** A Cell's stage: at work, needs you, or done (aski-manager.md, decision 7). */
export type Stage = "working" | "needs-you" | "done";

export interface CellStanding {
  readonly threadId: string;
  readonly projectId: string;
  /** Its chat's title: what it is on. */
  readonly title: string;
  readonly stage: Stage;
  /** Its own word: what it delivered when done, or what it waits on while at work. */
  readonly line: string | null;
  /** The roster lists the newest first. */
  readonly createdAt: string;
  /** When this stage began: its run's start while at work, its end once done. Absent or null otherwise. */
  readonly since?: string | null;
  /** How a done Cell landed; null at any other stage, absent from a server before the brief. */
  readonly landing?: Landing | null;
  readonly brief?: Brief | null;
}

/** An ask the person put off: its Cell is snoozed until `until`, then it is back. */
export interface LaterNeed extends Need {
  readonly until: string;
}

/** A Cell the person settled by hand, on any device. */
export interface HandSettle {
  readonly threadId: string;
  readonly at: string;
}

export interface NeedsList {
  readonly needs: ReadonlyArray<Need>;
  /** What the person put off, soonest back first; absent from a server before Later's seats. */
  readonly later?: ReadonlyArray<LaterNeed>;
  /** Every Cell in reach and its stage; absent from a server before stages. */
  readonly cells?: ReadonlyArray<CellStanding>;
  /**
   * Each settled Cell's latest settle by hand, for a day: a Mac closes its panes, a phone back
   * from away its chat. Absent from a server before them.
   */
  readonly settles?: ReadonlyArray<HandSettle>;
}

const isText = (value: unknown): value is string => typeof value === "string";
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

/** A reply's ask from a server before its steps and lead, with neither. */
const PROSE_BEFORE_STEPS = { steps: [], next: null, lead: null };

/**
 * The list, when `json` has the fields a reader keys on: each need's identity, kind, place and
 * age, and each Cell's stage. Null for anything else, such as another server's answer. A phone
 * meets older servers, so what an ask gained since is filled in.
 */
export function needsListOf(json: unknown): NeedsList | null {
  if (!isRecord(json) || !Array.isArray(json.needs)) return null;
  const needs = json.needs.every(
    (need: unknown) =>
      isRecord(need) &&
      isText(need.key) &&
      typeof need.number === "number" &&
      isText(need.kind) &&
      isText(need.threadId) &&
      isText(need.projectId) &&
      isText(need.since),
  );
  const cells =
    json.cells === undefined ||
    (Array.isArray(json.cells) &&
      json.cells.every(
        (cell: unknown) =>
          isRecord(cell) && isText(cell.threadId) && isText(cell.projectId) && isText(cell.stage),
      ));
  if (!needs || !cells) return null;
  return {
    ...json,
    needs: json.needs.map((need: Record<string, unknown>) =>
      isRecord(need.prose) ? { ...need, prose: { ...PROSE_BEFORE_STEPS, ...need.prose } } : need,
    ),
  } as unknown as NeedsList;
}
