// @effect-diagnostics globalDate:off - "yesterday" and "last week" are the reader's own calendar's, and the phone reads this file too.
/**
 * The time a question names ("two days ago", "last week", "on Tuesday", "in March"), read by
 * code against the reader's own clock and calendar. A loose phrase gets a loose window: a Cell
 * too many costs a glance, a Cell missed costs the answer. English only. Pure, and the phone
 * runs it: no newer built-ins.
 */

export interface When {
  /** The window, in epoch milliseconds: from inclusive, to exclusive. */
  readonly from: number;
  readonly to: number;
  /** The words it was read from, as written, and where they stand in the text. */
  readonly heard: string;
  readonly at: number;
}

const HOUR = 60 * 60 * 1000;

const COUNTS: Readonly<Record<string, number>> = {
  a: 1,
  an: 1,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  couple: 2,
  few: 3,
};

const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const MONTHS = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
];

const COUNT = String.raw`(\d{1,3}|an?|one|two|three|four|five|six|seven|eight|nine|ten|a couple(?: of)?|a few|couple(?: of)?|few)`;
const WEEKDAY = `(${WEEKDAYS.join("|")})`;
const MONTH = `(${MONTHS.join("|")})`;

function countOf(words: string): number {
  const said = words.toLowerCase().replace(/^a\s+(?=couple|few)/, "");
  const first = said.split(/\s+/)[0]!;
  return /^\d+$/.test(first) ? Number(first) : (COUNTS[first] ?? 1);
}

/** The start of the reader's day `days` after the day of `now` (before it, when negative). */
function dayStart(now: number, days: number): number {
  const date = new Date(now);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days).getTime();
}

/** Monday's start, `weeks` after this week's. */
function weekStart(now: number, weeks: number): number {
  const sinceMonday = (new Date(now).getDay() + 6) % 7;
  return dayStart(now, weeks * 7 - sinceMonday);
}

function monthStart(now: number, months: number): number {
  const date = new Date(now);
  return new Date(date.getFullYear(), date.getMonth() + months, 1).getTime();
}

/** How many days back the latest such weekday was; today's own counts as a week back. */
function daysBackTo(now: number, weekday: number): number {
  return (new Date(now).getDay() - weekday + 7) % 7 || 7;
}

/** The start of the latest such month that has begun. */
function latestMonth(now: number, month: number): number {
  const date = new Date(now);
  const year = month <= date.getMonth() ? date.getFullYear() : date.getFullYear() - 1;
  return new Date(year, month, 1).getTime();
}

type Window = readonly [from: number, to: number];
interface Phrase {
  readonly pattern: RegExp;
  readonly window: (match: RegExpExecArray, now: number) => Window;
}

const unitDays = (unit: string) =>
  unit.startsWith("week") ? 7 : unit.startsWith("month") ? 30 : 1;

/**
 * Tried in order, so the longer phrase wins over a shorter one inside it ("since last week"
 * before "last week"). Each window ends no later than tomorrow's start.
 */
const PHRASES: ReadonlyArray<Phrase> = [
  {
    // "in the last three days", "past two weeks"
    pattern: new RegExp(
      String.raw`\b(?:the )?(?:last|past) ${COUNT} (days?|weeks?|months?)\b`,
      "i",
    ),
    window: (match, now) => [
      dayStart(now, -countOf(match[1]!) * unitDays(match[2]!.toLowerCase())),
      dayStart(now, 1),
    ],
  },
  {
    // "the last week" runs up to now; "last week" below is the calendar's.
    pattern: /\b(?:the (?:last|past)|past) (day|week|month)\b/i,
    window: (match, now) => [dayStart(now, -unitDays(match[1]!.toLowerCase())), dayStart(now, 1)],
  },
  {
    pattern: new RegExp(String.raw`\bsince (?:last )?${WEEKDAY}\b`, "i"),
    window: (match, now) => [
      dayStart(now, -daysBackTo(now, WEEKDAYS.indexOf(match[1]!.toLowerCase()))),
      dayStart(now, 1),
    ],
  },
  {
    pattern: /\bsince yesterday\b/i,
    window: (_match, now) => [dayStart(now, -1), dayStart(now, 1)],
  },
  {
    pattern: /\bsince last (week|month)\b/i,
    window: (match, now) => [
      match[1]!.toLowerCase() === "week" ? weekStart(now, -1) : monthStart(now, -1),
      dayStart(now, 1),
    ],
  },
  {
    // "two days ago" is the day named and the one before it: memory rounds toward now.
    pattern: new RegExp(String.raw`\b${COUNT} (days?|weeks?|months?) (?:ago|back)\b`, "i"),
    window: (match, now) => {
      const count = countOf(match[1]!);
      const unit = match[2]!.toLowerCase();
      if (unit.startsWith("day")) {
        return count === 1
          ? [dayStart(now, -1), dayStart(now, 0)]
          : [dayStart(now, -count - 1), dayStart(now, -count + 1)];
      }
      if (unit.startsWith("week")) {
        return [dayStart(now, -count * 7 - 3), dayStart(now, -count * 7 + 4)];
      }
      return [monthStart(now, -count), monthStart(now, -count + 1)];
    },
  },
  {
    pattern: /\bthe day before yesterday\b/i,
    window: (_match, now) => [dayStart(now, -2), dayStart(now, -1)],
  },
  {
    pattern: /\blast night\b/i,
    window: (_match, now) => [dayStart(now, -1) + 17 * HOUR, dayStart(now, 0) + 5 * HOUR],
  },
  { pattern: /\byesterday\b/i, window: (_match, now) => [dayStart(now, -1), dayStart(now, 0)] },
  {
    pattern: /\b(?:earlier )?(?:today|this (?:morning|afternoon|evening)|tonight)\b/i,
    window: (_match, now) => [dayStart(now, 0), dayStart(now, 1)],
  },
  { pattern: /\bthis week\b/i, window: (_match, now) => [weekStart(now, 0), dayStart(now, 1)] },
  { pattern: /\blast week\b/i, window: (_match, now) => [weekStart(now, -1), weekStart(now, 0)] },
  { pattern: /\bthis month\b/i, window: (_match, now) => [monthStart(now, 0), dayStart(now, 1)] },
  {
    pattern: /\blast month\b/i,
    window: (_match, now) => [monthStart(now, -1), monthStart(now, 0)],
  },
  {
    // A month needs its lead-in: "may" and "march" are words of their own.
    pattern: new RegExp(String.raw`\b(?:in|during|from|back in|last) ${MONTH}\b`, "i"),
    window: (match, now) => {
      const month = MONTHS.indexOf(match[1]!.toLowerCase());
      const from = latestMonth(now, month);
      const start = new Date(from);
      return [from, new Date(start.getFullYear(), start.getMonth() + 1, 1).getTime()];
    },
  },
  {
    pattern: new RegExp(String.raw`\b(?:(?:on|last|this past|this) )?${WEEKDAY}\b`, "i"),
    window: (match, now) => {
      const back = daysBackTo(now, WEEKDAYS.indexOf(match[1]!.toLowerCase()));
      return [dayStart(now, -back), dayStart(now, -back + 1)];
    },
  },
  { pattern: /\bthe other day\b/i, window: (_match, now) => [dayStart(now, -7), dayStart(now, 0)] },
  {
    pattern: /\b(?:recently|lately)\b/i,
    window: (_match, now) => [dayStart(now, -14), dayStart(now, 1)],
  },
];

/** The first time the words name, by the order above; null when they name none. */
export function readWhen(text: string, now: number): When | null {
  for (const phrase of PHRASES) {
    const match = phrase.pattern.exec(text);
    if (match === null) continue;
    const [from, to] = phrase.window(match, now);
    return { from, to, heard: match[0], at: match.index };
  }
  return null;
}
