import * as Schema from "effect/Schema";

// How each ask ended, on this Mac only and sent nowhere (stemcells/tasks/aski-asks.md, decisions
// 11 to 13): answered from the ask alone, after opening its chat, flagged, or elsewhere. A kind
// flagged often shows the Cell's words whole; each flag keeps what its ask showed, as a case to
// learn from.

/** What a flagged ask showed: what it asked, and the Cell's words under it. */
const Shown = Schema.Struct({ ask: Schema.String, context: Schema.NullOr(Schema.String) });
export type Shown = typeof Shown.Type;

const AskRecord = Schema.Struct({
  /** The need's kind; a string, so a kind added later never makes the file unreadable. */
  kind: Schema.String,
  seenAt: Schema.Number,
  /** When it left the list; null while it is on it. */
  endedAt: Schema.NullOr(Schema.Number),
  /** The person's answer from the ask went to its Cell. */
  answered: Schema.Boolean,
  /** The person opened its chat from the ask. */
  opened: Schema.Boolean,
  /** "Not enough to decide", with what was missing when the person said, and what it showed. */
  flag: Schema.NullOr(
    Schema.Struct({
      at: Schema.Number,
      note: Schema.NullOr(Schema.String),
      shown: Schema.optionalKey(Shown),
    }),
  ),
});
export type AskRecord = typeof AskRecord.Type;

export const Ledger = Schema.Struct({
  version: Schema.Literal(1),
  asks: Schema.Record(Schema.String, AskRecord),
});
export type Ledger = typeof Ledger.Type;

export const EMPTY: Ledger = { version: 1, asks: {} };

export type Did = "answered" | "opened" | "flagged";

export type Ending = "alone" | "opened" | "flagged" | "elsewhere";

export interface KindMeasure {
  readonly kind: string;
  /** Asks of the kind that ended in the window. */
  readonly ended: number;
  /** Of those, answered from the ask alone and unflagged. */
  readonly alone: number;
  readonly flagged: number;
  /** Flagged often enough that its asks show the Cell's words whole. */
  readonly whole: boolean;
}

export interface Measure {
  readonly days: number;
  readonly kinds: ReadonlyArray<KindMeasure>;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const MEASURE_DAYS = 7;
/** Ended asks stay a month: the measure reads a week, and flagged ones are the asks to learn from. */
const KEEP_MS = 30 * DAY_MS;
const NOTE_MAX = 500;
const ASK_MAX = 500;
const CONTEXT_MAX = 4000;

/** A kind shows the Cell's words whole once two of its week's asks, and a quarter of them, were flagged. */
const showsWhole = (counts: { readonly ended: number; readonly flagged: number }) =>
  counts.flagged >= 2 && counts.flagged * 4 >= counts.ended;

/**
 * The ledger once the list holds `asks`: a new ask is recorded, one that left ends, and one
 * that came back (a snooze ran out) is open again. The same ledger when nothing changed.
 */
export function listed(
  ledger: Ledger,
  asks: ReadonlyArray<{ readonly key: string; readonly kind: string }>,
  now: number,
): Ledger {
  const live = new Map(asks.map((ask) => [ask.key, ask.kind]));
  let changed = false;
  const next: Record<string, AskRecord> = {};
  for (const [key, record] of Object.entries(ledger.asks)) {
    const there = live.has(key);
    if (!there && record.endedAt !== null && now - record.endedAt > KEEP_MS) {
      changed = true;
      continue;
    }
    if (there === (record.endedAt === null)) {
      next[key] = record;
      continue;
    }
    changed = true;
    next[key] = { ...record, endedAt: there ? null : now };
  }
  for (const [key, kind] of live) {
    if (key in next) continue;
    changed = true;
    next[key] = { kind, seenAt: now, endedAt: null, answered: false, opened: false, flag: null };
  }
  return changed ? { version: 1, asks: next } : ledger;
}

/** What the person did with an ask; an ask the ledger never saw is no ask of the list. */
export function mark(
  ledger: Ledger,
  key: string,
  did: Did,
  note: string | null,
  now: number,
  shown: Shown | null = null,
): Ledger {
  const record = ledger.asks[key];
  if (record === undefined) return ledger;
  const said = note?.trim().slice(0, NOTE_MAX) || null;
  const next: AskRecord =
    did === "answered"
      ? { ...record, answered: true }
      : did === "opened"
        ? { ...record, opened: true }
        : // A note said after the flag fills it in; flagging again keeps what was said.
          {
            ...record,
            flag: {
              at: record.flag?.at ?? now,
              note: said ?? record.flag?.note ?? null,
              ...(shown === null
                ? record.flag?.shown === undefined
                  ? {}
                  : { shown: record.flag.shown }
                : {
                    shown: {
                      ask: shown.ask.slice(0, ASK_MAX),
                      context: shown.context?.slice(0, CONTEXT_MAX) ?? null,
                    },
                  }),
            },
          };
  return { version: 1, asks: { ...ledger.asks, [key]: next } };
}

export function endingOf(record: AskRecord): Ending {
  if (record.flag !== null) return "flagged";
  if (record.opened) return "opened";
  return record.answered ? "alone" : "elsewhere";
}

/** Each kind's asks that ended in the last week, and how. */
export function measure(ledger: Ledger, now: number): Measure {
  const kinds = new Map<string, { ended: number; alone: number; flagged: number }>();
  for (const record of Object.values(ledger.asks)) {
    if (record.endedAt === null || now - record.endedAt > MEASURE_DAYS * DAY_MS) continue;
    const counts = kinds.get(record.kind) ?? { ended: 0, alone: 0, flagged: 0 };
    const ending = endingOf(record);
    kinds.set(record.kind, {
      ended: counts.ended + 1,
      alone: counts.alone + (ending === "alone" ? 1 : 0),
      flagged: counts.flagged + (ending === "flagged" ? 1 : 0),
    });
  }
  return {
    days: MEASURE_DAYS,
    kinds: [...kinds]
      .map(([kind, counts]) => ({ kind, ...counts, whole: showsWhole(counts) }))
      .toSorted((a, b) => b.ended - a.ended || a.kind.localeCompare(b.kind)),
  };
}
