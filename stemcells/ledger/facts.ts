// The facts the ledger keeps about Cells (`apps/server/src/stemcells/ledger`), as the server
// records them and `GET /api/stemcells/ledger` sends them. A fact is something that happened,
// kept for good: it outlives its chat, a rollback and upstream's schema. It carries no title,
// no words a Cell or the person wrote and no path.

/** Its chat was made. */
export interface Born {
  /** The name it was dealt (`stemcells/words/cellNames.ts`), kept should the names change. */
  readonly name: string;
  /** Its provider's driver (`claudeAgent`, `codex`, …), or its instance's id when unknown. */
  readonly driver: string | null;
  readonly projectId: string;
}

/** One of its runs completed. */
export interface Landed {
  readonly runId: string;
  /** From the run's start to its landing, in ms. */
  readonly ms: number;
  /** Of that, the time it worked alone, as growth counts it (`alone.ts`). */
  readonly aloneMs: number;
  /** How many times the run asked the person: approvals, questions, sign-ins. */
  readonly asks: number;
  /** The close-out its last reply ended with, or null when it wrote none. */
  readonly closeOut: "done" | "left" | null;
}

/** One of its pull requests merged. */
export interface Merged {
  readonly number: number;
}

export interface FactData {
  readonly born: Born;
  readonly landed: Landed;
  /** It was settled, by the person or by upstream's own rules. */
  readonly settled: Readonly<Record<string, never>>;
  readonly merged: Merged;
}

export type FactKind = keyof FactData;

/** A fact about one Cell. `key` is its identity: the same fact read twice is recorded once. */
export type Fact = {
  readonly [Kind in FactKind]: {
    readonly key: string;
    readonly kind: Kind;
    readonly threadId: string;
    /** When it happened, by upstream's clock, as an ISO time. */
    readonly at: string;
    readonly data: FactData[Kind];
  };
}[FactKind];

/** A fact as the ledger holds it. */
export type RecordedFact = Fact & {
  /** Its place in the ledger: the order facts were recorded in. */
  readonly seq: number;
  readonly environmentId: string;
  readonly recordedAt: string;
};

/** `GET /api/stemcells/ledger`, as the server sends it. */
export interface LedgerPage {
  readonly facts: ReadonlyArray<RecordedFact>;
  /** The `after` that reads the next page, or null at the ledger's end. */
  readonly next: number | null;
  /** Whether every chat made before the ledger was has been read into it. */
  readonly backfilled: boolean;
}
