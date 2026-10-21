/**
 * What needs the person, as the server sends it (`GET /api/stemcells/needs`
 * and its stream; apps/server/src/stemcells/needs/derive.ts keeps the other
 * copy of these types).
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
  }>;
  readonly multiSelect: boolean;
  readonly allowCustomAnswer: boolean;
}

export interface NeedRequest {
  readonly id: string;
  readonly kind: RequestKind;
  readonly prompt: string | null;
  readonly appName: string | null;
  readonly options: ReadonlyArray<{
    readonly decision: ApprovalDecision;
    readonly label: string;
    readonly warning?: string;
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
    /** What the pre-read found: a question, an offer to go on, or a stop short of done. */
    readonly cue: "question" | "offer" | "stopped";
    /** The reply's last paragraph, word for word. */
    readonly text: string;
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
}

export interface NeedsList {
  readonly needs: ReadonlyArray<Need>;
}
