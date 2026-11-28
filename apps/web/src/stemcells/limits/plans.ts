/**
 * Each plan's limits as the rail's ring, its hover and the Usage page show them
 * (`stemcells/tasks/plan-limits.md`): a plan is an account, with a session window (5h) and a long
 * one (7d, else a month), each read for what is left, when it resets and whether the pace so far
 * runs it out first.
 */
import type { ChatWork, InstanceKey, LimitAccount, LimitWindow } from "../upstream/limitAccounts";

const MINUTE = 60_000;

/** Fine; short (a tenth or less left, or the pace runs out before the reset); out. */
export type PlanTone = "fine" | "short" | "out";

const SEVERITY: Readonly<Record<PlanTone, number>> = { fine: 0, short: 1, out: 2 };

export interface WindowReading {
  /** Percent left, 0 to 100. */
  readonly left: number;
  /** When it refills, epoch ms; null when unknown or not yet started. */
  readonly resetsAt: number | null;
  /** When the pace so far empties it, if before the reset; epoch ms. */
  readonly runsOutAt: number | null;
  /** The percent an even pace would have left by now; null without a clock. */
  readonly evenLeft: number | null;
  readonly tone: PlanTone;
  /** A narrower window's say ("Fable 9%"), or "month" for a month standing in for the week. */
  readonly note: string | null;
  /** Whether it stops only some models (a model's own week), not the whole plan. */
  readonly scoped: boolean;
}

/** One line of a plan's card: the plan's own session and week, then each model's own window. */
export interface PlanRow {
  /** "Session", "Week", "Month", or a model's window by its scope: "Fable", "Go · Week". */
  readonly label: string;
  readonly reading: WindowReading;
}

export interface PlanReading {
  readonly account: LimitAccount;
  /** The person's name for the plan, else its masked email, else its tier. */
  readonly name: string;
  /** Whether `name` is one the person gave. */
  readonly named: boolean;
  /** Chats working on it now. */
  readonly working: number;
  readonly session: WindowReading | null;
  readonly long: WindowReading | null;
  readonly tone: PlanTone;
  /** What the card lists, in order. */
  readonly rows: ReadonlyArray<PlanRow>;
}

/** "someone@example.com" → "so…@example.com": enough to tell plans apart, not to read it out. */
export function maskedEmail(email: string): string {
  const at = email.lastIndexOf("@");
  if (at <= 0) return `${email.slice(0, 2)}…`;
  return `${email.slice(0, Math.min(2, at))}…${email.slice(at)}`;
}

function nameOf(account: LimitAccount, providerName: string): { name: string; named: boolean } {
  if (account.displayName) return { name: account.displayName, named: true };
  if (account.email) return { name: maskedEmail(account.email.trim()), named: false };
  return { name: account.plan ?? providerName, named: false };
}

const KIND_WORDS = /^(weekly|session|5-hour|5h|monthly|quota|subscription)$/i;

/** The part of a window's label that isn't its length: "Weekly · Fable" → "Fable". */
function scopeOf(label: string): string | null {
  const scope = label
    .split(" · ")
    .filter((part) => !KIND_WORDS.test(part.trim()))
    .join(" · ")
    .trim();
  return scope === "" ? null : scope;
}

function resetMillis(window: LimitWindow): number | null {
  if (window.resetsAt === undefined) return null;
  const at = Date.parse(window.resetsAt);
  return Number.isFinite(at) ? at : null;
}

/**
 * One window now. Its pace is its own average since it opened (used over
 * elapsed, at the reading), judged once a tenth of it has passed and 3% is
 * used: earlier, a burst reads as a trend.
 */
export function readWindow(
  window: LimitWindow,
  checkedAt: number,
  now: number,
  scope: string | null = null,
): WindowReading {
  const note = scope;
  const scoped = scope !== null;
  const resetsAt = resetMillis(window);
  // A window past its reset has refilled, whatever the last reading said.
  if (resetsAt !== null && resetsAt <= now) {
    return {
      left: 100,
      resetsAt: null,
      runsOutAt: null,
      evenLeft: null,
      tone: "fine",
      note,
      scoped,
    };
  }
  const used = Math.max(0, Math.min(100, window.usedPercent));
  const left = Math.round(100 - used);
  const length = (window.windowDurationMins ?? 0) * MINUTE;
  let runsOutAt: number | null = null;
  let evenLeft: number | null = null;
  if (resetsAt !== null && length > 0) {
    evenLeft = Math.round(Math.max(0, Math.min(1, (resetsAt - now) / length)) * 100);
    const elapsed = length - (resetsAt - checkedAt);
    if (used < 100 && used >= 3 && elapsed >= length / 10) {
      const at = checkedAt + ((100 - used) / used) * elapsed;
      if (at < resetsAt) runsOutAt = Math.max(at, now);
    }
  }
  return { left, resetsAt, runsOutAt, evenLeft, tone: toneOf(left, runsOutAt), note, scoped };
}

function toneOf(left: number, runsOutAt: number | null): PlanTone {
  return left <= 0 ? "out" : runsOutAt !== null || left <= 10 ? "short" : "fine";
}

/** The worst off, then the least left. */
function tightest(readings: ReadonlyArray<WindowReading>): WindowReading | null {
  let best: WindowReading | null = null;
  for (const reading of readings) {
    if (
      best === null ||
      SEVERITY[reading.tone] > SEVERITY[best.tone] ||
      (reading.tone === best.tone && reading.left < best.left)
    ) {
      best = reading;
    }
  }
  return best;
}

function worse(left: PlanTone, right: PlanTone): PlanTone {
  return SEVERITY[right] > SEVERITY[left] ? right : left;
}

/**
 * A plan's windows of one kind as one reading: the plan's own (unscoped, or the only one). A
 * model's window ("Weekly · Fable") stops that model, not the plan: running short it only marks
 * the reading short and names itself ("Fable 9%"). With only scoped windows (Antigravity's
 * families, Cursor's pools), the tightest stands in, short at worst, never out.
 */
function windowOfKind(
  windows: ReadonlyArray<LimitWindow>,
  checkedAt: number,
  now: number,
): WindowReading | null {
  const ownWindows =
    windows.length === 1 ? windows : windows.filter((window) => scopeOf(window.label) === null);
  const own = tightest(ownWindows.map((window) => readWindow(window, checkedAt, now)));
  const narrow = tightest(
    windows
      .filter((window) => !ownWindows.includes(window))
      .map((window) => readWindow(window, checkedAt, now, scopeOf(window.label))),
  );
  if (own === null) {
    return narrow === null ? null : { ...narrow, tone: capped(narrow.tone) };
  }
  if (narrow === null || narrow.tone === "fine") return own;
  return { ...own, tone: worse(own.tone, "short"), note: `${narrow.note} ${narrow.left}%` };
}

function capped(tone: PlanTone): PlanTone {
  return tone === "out" ? "short" : tone;
}

export function readPlan(
  account: LimitAccount,
  working: number,
  providerName: string,
  now: number,
): PlanReading {
  const checkedAt = Date.parse(account.limits.checkedAt);
  const read = Number.isFinite(checkedAt) ? checkedAt : now;
  const ofKind = (kind: LimitWindow["kind"]) =>
    account.limits.windows.filter((window) => window.kind === kind);
  const weekly = ofKind("weekly");
  const monthly = ofKind("monthly");
  // A plan with a week has the month as a spending cap beside it, not its limit.
  const longKind =
    weekly.length > 0
      ? { windows: weekly, label: "Week" }
      : monthly.length > 0
        ? { windows: monthly, label: "Month" }
        : { windows: ofKind("other"), label: "Limit" };
  const long =
    longKind.label === "Month"
      ? withNote(windowOfKind(monthly, read, now), "month")
      : windowOfKind(longKind.windows, read, now);
  let session = windowOfKind(ofKind("session"), read, now);
  // A spent week blocks the session too, whatever it has left, until the week resets.
  if (session !== null && long !== null && long.tone === "out" && !long.scoped) {
    session = {
      ...session,
      left: 0,
      tone: "out",
      runsOutAt: null,
      evenLeft: null,
      resetsAt:
        session.tone === "out" && session.resetsAt !== null && long.resetsAt !== null
          ? Math.max(session.resetsAt, long.resetsAt)
          : long.resetsAt,
    };
  }
  return {
    account,
    ...nameOf(account, providerName),
    working,
    session,
    long,
    tone: worse(session?.tone ?? "fine", long?.tone ?? "fine"),
    rows: rowsOf(
      [{ windows: ofKind("session"), label: "Session" }, longKind],
      [session, long],
      read,
      now,
    ),
  };
}

const KIND_LABEL: Readonly<Record<LimitWindow["kind"], string>> = {
  session: "Session",
  weekly: "Week",
  monthly: "Month",
  other: "Limit",
};

/** The windows a plan's own reading of one kind is made of: the unscoped ones, or the only one. */
function ownWindowsOf(windows: ReadonlyArray<LimitWindow>): ReadonlyArray<LimitWindow> {
  return windows.length === 1
    ? windows
    : windows.filter((window) => scopeOf(window.label) === null);
}

/**
 * The card's rows: the plan's own session and long window, then every model's window of those
 * kinds by its scope, with its length once a scope has more than one ("Go · Week").
 */
function rowsOf(
  kinds: ReadonlyArray<{ readonly windows: ReadonlyArray<LimitWindow>; readonly label: string }>,
  own: ReadonlyArray<WindowReading | null>,
  checkedAt: number,
  now: number,
): ReadonlyArray<PlanRow> {
  const rows: PlanRow[] = [];
  const scoped: Array<{ window: LimitWindow; scope: string }> = [];
  kinds.forEach((kind, index) => {
    const reading = own[index] ?? null;
    const ownWindows = ownWindowsOf(kind.windows);
    if (reading !== null && !reading.scoped && ownWindows.length > 0) {
      // A model running short has its own row, so the plan's row reads only its own window.
      rows.push({
        label: kind.label,
        reading: { ...reading, tone: toneOf(reading.left, reading.runsOutAt), note: null },
      });
    }
    for (const window of kind.windows) {
      const scope = scopeOf(window.label);
      if (scope !== null && !ownWindows.includes(window)) scoped.push({ window, scope });
    }
  });
  const lengths = new Map<string, Set<string>>();
  for (const { window, scope } of scoped) {
    lengths.set(scope, (lengths.get(scope) ?? new Set()).add(window.kind));
  }
  // A scope's windows together, in the order the scopes first come.
  const order = [...lengths.keys()];
  scoped.sort((left, right) => order.indexOf(left.scope) - order.indexOf(right.scope));
  for (const { window, scope } of scoped) {
    rows.push({
      label: (lengths.get(scope)?.size ?? 0) > 1 ? `${scope} · ${KIND_LABEL[window.kind]}` : scope,
      reading: readWindow(window, checkedAt, now, scope),
    });
  }
  return rows;
}

/** The window the ring shows: of the plan's session and long window, the one that stops it first. */
export function bindingOf(plan: PlanReading): WindowReading | null {
  return tightest([plan.session, plan.long].filter((window) => window !== null));
}

/**
 * The ring's figure: the percent of its binding window used, or once the plan is out, how long
 * until it frees ("45m", "3h", "2d").
 */
export function ringFigure(plan: PlanReading, now: number): string | null {
  const binding = bindingOf(plan);
  if (binding === null) return null;
  if (plan.tone === "out") {
    const until = freedAt(plan);
    if (until !== null) return shortWait(until - now);
  }
  return String(100 - binding.left);
}

/** When an out plan frees: the later reset of the windows that hold it. */
function freedAt(plan: PlanReading): number | null {
  const until = Math.max(
    ...[plan.session, plan.long].flatMap((window) =>
      window !== null && !window.scoped && window.tone === "out" && window.resetsAt !== null
        ? [window.resetsAt]
        : [],
    ),
  );
  return Number.isFinite(until) ? until : null;
}

/** A wait in its largest unit, rounded up: "45m", "3h", "2d". */
export function shortWait(ms: number): string {
  const minutes = Math.max(1, Math.ceil(ms / MINUTE));
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.ceil(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.ceil(hours / 24)}d`;
}

/**
 * The card's order: the ring's plan first, then where there is the most room, so the next plan
 * to hop to sits under the one you're on. Out plans go last.
 */
export function boardOrder(
  plans: ReadonlyArray<PlanReading>,
  ring: PlanReading | null,
): ReadonlyArray<PlanReading> {
  const room = (plan: PlanReading) => bindingOf(plan)?.left ?? -1;
  const rest = plans
    .filter((plan) => plan !== ring)
    .sort(
      (left, right) =>
        SEVERITY[left.tone] - SEVERITY[right.tone] ||
        room(right) - room(left) ||
        left.name.localeCompare(right.name),
    );
  return ring === null ? rest : [ring, ...rest];
}

function withNote(reading: WindowReading | null, note: string): WindowReading | null {
  return reading === null ? null : { ...reading, note: reading.note ?? note };
}

/** Every plan, the ones at work first, then the worse off, then by name. */
export function readPlans(
  accounts: ReadonlyArray<LimitAccount>,
  accountOf: (instance: InstanceKey) => LimitAccount | null,
  work: ChatWork,
  providerName: (driver: LimitAccount["driver"]) => string,
  now: number,
): ReadonlyArray<PlanReading> {
  const working = new Map<string, number>();
  for (const [instance, count] of work.working) {
    const account = accountOf(instance);
    if (account) working.set(account.key, (working.get(account.key) ?? 0) + count);
  }
  return accounts
    .map((account) =>
      readPlan(account, working.get(account.key) ?? 0, providerName(account.driver), now),
    )
    .sort(
      (left, right) =>
        Number(right.working > 0) - Number(left.working > 0) ||
        SEVERITY[right.tone] - SEVERITY[left.tone] ||
        left.name.localeCompare(right.name),
    );
}

/**
 * The plan the ring shows: the plan you're on. Of the plans with a chat at
 * work, the worst off; with none at work, the plan of the chat written to
 * last; else the first.
 */
export function ringPlan(
  plans: ReadonlyArray<PlanReading>,
  lastWritten: LimitAccount | null,
): PlanReading | null {
  const atWork = plans.filter((plan) => plan.working > 0);
  if (atWork.length > 0) {
    return atWork.reduce((best, plan) => (SEVERITY[plan.tone] > SEVERITY[best.tone] ? plan : best));
  }
  return plans.find((plan) => plan.account.key === lastWritten?.key) ?? plans[0] ?? null;
}

/** Where the plan you're on stands, said in two lines: the one to read, and what follows from it. */
export interface Standing {
  readonly tone: PlanTone;
  readonly lead: string;
  readonly detail: string | null;
}

const DAY = 24 * 60 * MINUTE;

/** When `at` comes: "in 2h 10m" under a day, else its clock ("Tue 20.00"). */
function whenAt(
  at: number,
  now: number,
  clock: (at: number) => string,
  duration: (ms: number) => string,
): string {
  return at - now < DAY ? `in ${duration(at - now)}` : clock(at);
}

/**
 * The ring's plan, said at the card's top: limited until when; else when the pace runs it out
 * and how long before its reset; else, low on room, what is left; else when it resets.
 */
export function standingOf(
  plan: PlanReading,
  now: number,
  clock: (at: number) => string,
  duration: (ms: number) => string,
): Standing | null {
  const until = freedAt(plan);
  if (until !== null) {
    return {
      tone: "out",
      lead: `Limited until ${clock(until)}`,
      detail: `Frees ${whenAt(until, now, clock, duration)}`,
    };
  }
  // A model's own window stops that model only, never the plan.
  const next = [plan.session, plan.long]
    .flatMap((window) =>
      window !== null && !window.scoped && window.runsOutAt !== null && window.resetsAt !== null
        ? [{ at: window.runsOutAt, resetsAt: window.resetsAt }]
        : [],
    )
    .sort((left, right) => left.at - right.at)[0];
  if (next !== undefined) {
    return {
      tone: "short",
      lead: `Runs out ${clock(next.at)}`,
      detail: `${duration(next.resetsAt - next.at)} before it resets ${clock(next.resetsAt)}`,
    };
  }
  const binding = bindingOf(plan);
  if (binding === null || binding.resetsAt === null) return null;
  const resets = `Resets ${whenAt(binding.resetsAt, now, clock, duration)}`;
  // Short only for a model's own window, the plan itself has room: its row says so.
  return binding.left > 10
    ? { tone: "fine", lead: resets, detail: null }
    : { tone: "short", lead: `${binding.left}% left`, detail: resets };
}

/**
 * A row's when: when the pace runs the window out, if it does before the reset, else when it
 * resets. `both` says the reset after a run out too, where there is room.
 */
export function windowWhen(
  window: WindowReading,
  now: number,
  clock: (at: number) => string,
  duration: (ms: number) => string,
  both = false,
): string {
  if (window.resetsAt === null) return "";
  const resets = whenAt(window.resetsAt, now, clock, duration);
  if (window.runsOutAt === null) return `Resets ${resets}`;
  const out = `Runs out ${clock(window.runsOutAt)}`;
  return both ? `${out} · resets ${resets}` : out;
}
