/**
 * A Cell's card: what recall keeps of a Cell (stemcells/tasks/aski-orchestrator.md, decision 8),
 * as the server writes it and both clients read it. No model writes one: the summary is the
 * Cell's own close-out. Types only, and the wire shape of `GET /api/stemcells/recall`.
 */

/** How a landed Cell landed (`needs/verdict.ts` on the server). */
export type RecallVerdict = "shown" | "claimed" | "short";

export interface RecallPullRequest {
  readonly number: number;
  readonly url: string;
  readonly state: "open" | "closed" | "merged";
  readonly draft: boolean;
  readonly checks: "passing" | "failing" | "pending" | null;
}

export interface RecallCheck {
  readonly kind: "test" | "typecheck" | "lint" | "build";
  readonly ok: boolean;
}

export interface RecallCard {
  readonly threadId: string;
  readonly environmentId: string;
  readonly projectId: string;
  /** The project's title when the card was written. */
  readonly project: string;
  readonly title: string;
  /** The opening of each message in the person's seat, oldest first, capped in number. */
  readonly asked: ReadonlyArray<string>;
  /** The Cell's own close-out line: what it delivered, or what is left. */
  readonly line: string | null;
  /** How it last landed; null before any landing. */
  readonly verdict: RecallVerdict | null;
  /** The fact the verdict stands on, as `needs/verdict.ts` names it. */
  readonly proof: string | null;
  readonly changed: {
    readonly files: number;
    readonly additions: number;
    readonly deletions: number;
  } | null;
  readonly checks: ReadonlyArray<RecallCheck>;
  readonly pullRequest: RecallPullRequest | null;
  readonly model: string | null;
  readonly bornAt: string;
  readonly landedAt: string | null;
  readonly awake: boolean;
  /** A run is under way. */
  readonly flying: boolean;
  /** The Cell as a Markdown link both clients draw as its pill. */
  readonly link: string;
}

/** What a question was read as, so a reader can say what it searched for. */
export interface RecallRead {
  readonly from: string | null;
  readonly to: string | null;
  readonly project: { readonly id: string; readonly title: string } | null;
  /** The free words searched for, after the time, the project and the filler went. */
  readonly words: ReadonlyArray<string>;
  /** The time named held no match for the words, so every time was searched. */
  readonly widened: boolean;
}

export interface RecallAnswer {
  readonly cards: ReadonlyArray<RecallCard>;
  /** Matching Cells beyond `cards`. */
  readonly more: number;
  readonly read: RecallRead;
}

export type RecallState = "awake" | "asleep" | "both";

export const RECALL_PATH = "/api/stemcells/recall";
