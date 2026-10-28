/**
 * What a card says and offers, from the need the server sent (stemcells/tasks/aski-room.md,
 * "Item types" and decision 5). Asks show as the Cell asked them. Every option is one app
 * action, and what reaches the Cell is its own words, a fixed phrase shown on the option, or
 * the person's own words.
 */
import { DISK_FULL } from "../../../../../stemcells/words/disk.ts";
import type { DiskFailure } from "../disk/pressure";
import type { ApprovalDecision, AskedQuestion, Need, NeedRequest } from "./wire";

/** What choosing an option does; `actions.ts` turns it into upstream's commands. */
export type Choice =
  | { readonly kind: "decide"; readonly decision: ApprovalDecision }
  | { readonly kind: "declineWithNote" }
  | { readonly kind: "answer" }
  | { readonly kind: "dismissQuestion" }
  | { readonly kind: "build" }
  | { readonly kind: "revise" }
  | { readonly kind: "carryOn" }
  | { readonly kind: "continueNow" }
  | { readonly kind: "retry" }
  | { readonly kind: "reply" }
  | { readonly kind: "dismiss" }
  | { readonly kind: "later" }
  | { readonly kind: "goAhead" }
  | { readonly kind: "didIt" }
  | { readonly kind: "nothingToDo" }
  | { readonly kind: "nudge" }
  | { readonly kind: "stopAndReply" }
  | { readonly kind: "wait" };

export interface CardOption {
  readonly id: string;
  readonly title: string;
  readonly consequence: string | null;
  readonly recommended: boolean;
  /** The provider warned about it. */
  readonly warn: boolean;
  /** Lets a Cell do something: never from words, and not in the card's first moment. */
  readonly allows: boolean;
  /** Set when the option sends the person's words: the field's placeholder. */
  readonly words: string | null;
  readonly choice: Choice;
}

export interface CardQuestion {
  readonly id: string;
  readonly header: string;
  readonly question: string;
  readonly multiSelect: boolean;
  readonly options: ReadonlyArray<{
    readonly label: string;
    readonly description: string;
    /** What the answer carries: the Cell's value for the option, else its label. */
    readonly answer: string;
    readonly recommended: boolean;
  }>;
  /** Set when the Cell takes an answer of the person's own: the field's placeholder. */
  readonly other: string | null;
}

export interface Card {
  /** What the Cell asks, in one line: the question itself where it has one. */
  readonly headline: string;
  /** The request whole, in monospace: the person allows exactly what they read. */
  readonly request: string | null;
  /** The Cell's or provider's own words, quoted. */
  readonly quote: string | null;
  readonly steps: ReadonlyArray<string>;
  readonly questions: ReadonlyArray<CardQuestion>;
  readonly options: ReadonlyArray<CardOption>;
  /** Why the card offers no answer of its own, when it doesn't. */
  readonly note: string | null;
  /** Why a Cell with full access asks at all, when it still does. */
  readonly why: string | null;
  /** "Later" snoozes the Cell for an hour; upstream refuses it while a request waits. */
  readonly later: boolean;
}

/** How long "Wait 15 min" holds a stuck card back. */
export const WAIT_MS = 15 * 60 * 1000;

const ASKS: Partial<Record<NonNullable<Need["request"]>["kind"], string>> = {
  command: "Run this command",
  "file-change": "Change these files",
  "file-read": "Read this file",
  permission: "Allow this",
};

const DECISION_CONSEQUENCES: Record<ApprovalDecision, string> = {
  accept: "Just this once.",
  acceptForSession: "For the rest of this session.",
  acceptAlways: "From now on.",
  decline: "It goes on without it.",
  cancel: "Stops its turn.",
};

/** Upstream's own buttons when the provider names none, in its order. */
const DEFAULT_DECISIONS: ReadonlyArray<{ decision: ApprovalDecision; label: string }> = [
  { decision: "accept", label: "Approve" },
  { decision: "acceptForSession", label: "Always allow this session" },
  { decision: "decline", label: "Decline" },
];

const FAILURES: Record<NonNullable<NonNullable<Need["failure"]>["errorClass"]>, string> = {
  usage_limit: "Hit its usage limit",
  provider_error: "Its provider returned an error",
  transport_error: "Lost its connection",
  permission_error: "Was refused access",
  validation_error: "Sent something its provider refused",
  unknown: "Stopped with an error",
};

/** The fixed phrases an option may send, shown on the option itself. */
export const PHRASES = {
  retry: "Try that again.",
  // Upstream's own words when it resumes a run stopped by a limit (ChatView).
  continueNow: "Continue where you left off.",
  goAhead: "Go ahead.",
  didIt: "Done. Carry on.",
} as const;

const RECOMMENDED = /\s*\(recommended\)\s*/i;

const option = (
  id: string,
  title: string,
  choice: Choice,
  rest: Partial<Omit<CardOption, "id" | "title" | "choice">> = {},
): CardOption => ({
  id,
  title,
  choice,
  consequence: rest.consequence ?? null,
  recommended: rest.recommended ?? false,
  warn: rest.warn ?? false,
  allows: rest.allows ?? false,
  words: rest.words ?? null,
});

/** Snoozes the Cell for an hour, through upstream's snooze. */
/** Why a Cell with full access still asks, by the kind upstream reports. */
const FULL_ACCESS_WHY: Record<NonNullable<NeedRequest["fullAccessOverride"]>, string> = {
  ask_rule: "Asked despite full access: an ask rule in the provider's settings matches this.",
  provider_check:
    "Asked despite full access: the provider checks this itself, and no setting skips it.",
};

export const LATER: CardOption = option("later", "Later", { kind: "later" });

/** "Go ahead" and "Nothing to do", the fixed ways out of a reply that asks or stops short. */
const goAhead = (recommended: boolean) =>
  option(
    "go-ahead",
    "Go ahead",
    { kind: "goAhead" },
    { consequence: `Sends “${PHRASES.goAhead}”`, recommended },
  );
/** The id of "Nothing to do", which the card shows as its Settle. */
export const NOTHING_TO_DO = "nothing-to-do";
const nothingToDo = option(
  NOTHING_TO_DO,
  "Nothing to do",
  { kind: "nothingToDo" },
  { consequence: "Settles the Cell. Nothing is sent." },
);
const reply = (placeholder: string) =>
  option("reply", "Reply…", { kind: "reply" }, { words: placeholder });

/** What a reply asks when no sentence of its own asks it. */
const PROSE: Record<NonNullable<Need["prose"]>["cue"], string> = {
  question: "Has a question",
  offer: "Offers to go on",
  stopped: "Stopped short of done. Go on?",
  left: "Left a step to you. Done it?",
};

/** A sentence's end: its stop, any closing quote or bracket, then space. */
const SENTENCE = /(?<=[.!?…]["'”’)\]]*)\s+(?=\S)/u;
/** A sentence that asks: it ends on a question mark. */
const ASKING = /\?["'”’)\]]*$/u;
/** A list's marker standing alone ("2."), left over from splitting "2. Should we…?". */
const MARKER = /^(?:[-*+•]|\d{1,2}[.)])$/u;

/**
 * The Cell's own question in a paragraph, and the rest as its context, in order: the last
 * sentence that asks. Null when no sentence asks ("Let me know which you'd like.").
 */
export function askOf(
  text: string,
): { readonly ask: string; readonly context: string | null } | null {
  const sentences = text.trim().split(SENTENCE);
  const at = sentences.findLastIndex((sentence) => ASKING.test(sentence));
  if (at === -1) return null;
  const marked = at > 0 && MARKER.test(sentences[at - 1]!);
  const rest = [...sentences.slice(0, marked ? at - 1 : at), ...sentences.slice(at + 1)];
  return { ask: sentences[at]!, context: rest.length === 0 ? null : rest.join(" ") };
}

/** The person did the step a Cell left them, and tells it so. */
const didIt = option(
  "did-it",
  "Done it",
  { kind: "didIt" },
  { consequence: `Sends “${PHRASES.didIt}”` },
);

function questionOf(question: AskedQuestion): CardQuestion {
  return {
    id: question.id,
    header: question.header,
    question: question.question,
    multiSelect: question.multiSelect,
    options: question.options.map((choice) => {
      const label = choice.label.replace(RECOMMENDED, " ").trim();
      const description = choice.description.replace(RECOMMENDED, " ").trim();
      return {
        label,
        // Some providers repeat the label as its description: say it once.
        description: description === label ? "" : description,
        answer: choice.value ?? choice.label,
        recommended: RECOMMENDED.test(choice.label),
      };
    }),
    other: question.allowCustomAnswer ? "Your own answer…" : null,
  };
}

/** "today 14:00", "tomorrow 09:00", "Mon 09:00", "27 Oct 09:00": when a reset comes, in the person's words. */
export function whenOf(iso: string, now: number, locale?: string, timeZone?: string): string {
  const at = new Date(iso);
  const time = new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
    timeZone,
  }).format(at);
  const day = (ms: number) =>
    new Intl.DateTimeFormat("en-CA", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      timeZone,
    }).format(ms);
  const daysAhead = Math.round((Date.parse(day(at.getTime())) - Date.parse(day(now))) / 86_400_000);
  if (daysAhead === 0) return `today ${time}`;
  if (daysAhead === 1) return `tomorrow ${time}`;
  const date = new Intl.DateTimeFormat(
    locale,
    daysAhead > 1 && daysAhead < 7
      ? { weekday: "short", timeZone }
      : { day: "numeric", month: "short", timeZone },
  ).format(at);
  return `${date} ${time}`;
}

const base = (need: Need) => ({
  request: null,
  quote: null,
  steps: [],
  questions: [],
  options: [],
  note: null,
  why: null,
  later: need.request === null,
});

/**
 * The card for a need, as of `now`. `disk` is a failure's reading against
 * its machine's free space (`diskFailure`): a turn the full disk stopped
 * says so, and a retry is worth it only once there's room again.
 */
export function cardOf(need: Need, now: number, disk: DiskFailure = null): Card {
  const request = need.request;
  switch (need.kind) {
    case "permission": {
      const asks = ASKS[request?.kind ?? "permission"] ?? "Allow this";
      const headline = request?.appName ? `${asks} in ${request.appName}?` : `${asks}?`;
      if (request?.capability !== "live") {
        return {
          ...base(need),
          headline,
          request: request?.prompt ?? null,
          note:
            request?.capability === null
              ? "Couldn't read this ask. Its chat has it."
              : "This ask can't be answered from here any more. Its chat has it.",
        };
      }
      const decisions = request.options.length > 0 ? request.options : DEFAULT_DECISIONS;
      return {
        ...base(need),
        headline,
        request: request.prompt,
        quote: request.reason,
        why:
          request.fullAccessOverride === null ? null : FULL_ACCESS_WHY[request.fullAccessOverride],
        options: [
          ...decisions.map((choice, index) =>
            option(
              `decide-${index}`,
              choice.label,
              { kind: "decide", decision: choice.decision },
              {
                consequence:
                  ("warning" in choice ? choice.warning : undefined) ??
                  DECISION_CONSEQUENCES[choice.decision],
                warn: "warning" in choice && choice.warning !== undefined,
                allows: choice.decision.startsWith("accept"),
              },
            ),
          ),
          option(
            "decline-note",
            "Decline…",
            { kind: "declineWithNote" },
            {
              consequence: "Say why, or what to do instead.",
              words: "Why not, or what instead…",
            },
          ),
        ],
      };
    }
    case "question": {
      const questions = request?.questions ?? [];
      const answerable =
        request !== null && request.capability !== "not_resumable" && questions.length > 0;
      return {
        ...base(need),
        headline:
          questions.length > 1
            ? `${questions.length} questions`
            : (questions[0]?.question ?? "Has a question"),
        questions: answerable ? questions.map(questionOf) : [],
        quote: null,
        options:
          answerable && request.responseMode === "message"
            ? [
                option(
                  "dismiss-question",
                  "Dismiss",
                  { kind: "dismissQuestion" },
                  {
                    consequence: "It goes on without an answer.",
                  },
                ),
              ]
            : [],
        note: answerable
          ? null
          : request?.capability === null || questions.length === 0
            ? "Couldn't read this question. Its chat has it."
            : "This question can't be answered from here any more. Its chat has it.",
      };
    }
    case "sign-in":
      return { ...base(need), headline: "Needs you to sign in again" };
    case "input":
      return {
        ...base(need),
        headline: request?.appName ? `${request.appName} asks for input` : "Asks for input",
        note: "Its chat has the form to fill in.",
      };
    case "limit": {
      const resetAt = need.limit?.resetAt ?? null;
      const reset = resetAt === null ? null : Date.parse(resetAt);
      const when = resetAt === null ? null : whenOf(resetAt, now);
      return {
        ...base(need),
        headline: when === null ? "Hit its usage limit" : `Hit its usage limit · resets ${when}`,
        options:
          reset === null || Number.isNaN(reset)
            ? []
            : reset > now
              ? [
                  option(
                    "carry-on",
                    "Carry on at the reset",
                    { kind: "carryOn" },
                    {
                      consequence: `Snoozes it until ${when}, then it goes on by itself.`,
                    },
                  ),
                ]
              : [
                  option(
                    "continue",
                    "Continue now",
                    { kind: "continueNow" },
                    {
                      consequence: `Sends “${PHRASES.continueNow}”`,
                    },
                  ),
                ],
      };
    }
    case "failed": {
      const errorClass = need.failure?.errorClass ?? "unknown";
      // A limit is the provider's say, whatever the disk.
      const reading = errorClass === "usage_limit" ? null : disk;
      const full = reading === "full";
      return {
        ...base(need),
        headline: full
          ? DISK_FULL.title
          : reading === "freed"
            ? DISK_FULL.freedTitle
            : FAILURES[errorClass],
        quote: full
          ? DISK_FULL.note
          : reading === "freed"
            ? DISK_FULL.freedNote
            : (need.failure?.message ?? null),
        options: [
          option(
            "retry",
            "Retry",
            { kind: "retry" },
            {
              consequence: `Sends “${PHRASES.retry}”`,
              recommended:
                !full &&
                (reading === "freed" ||
                  errorClass === "transport_error" ||
                  errorClass === "provider_error"),
            },
          ),
          reply("Tell it what to do…"),
          option(
            "dismiss",
            "Dismiss",
            { kind: "dismiss" },
            {
              consequence: "Marks it seen. Nothing is sent.",
            },
          ),
        ],
      };
    }
    case "plan": {
      const plan = need.plan;
      const buildable = plan !== null && plan.id !== null && plan.markdown !== null;
      return {
        ...base(need),
        headline: plan?.title ? `Build “${plan.title}”?` : "Build the plan?",
        steps: plan?.steps ?? [],
        options: buildable
          ? [
              option(
                "build",
                "Implement",
                { kind: "build" },
                {
                  consequence: "Leaves plan mode and sends the plan back to build.",
                  recommended: true,
                },
              ),
              option("revise", "Refine…", { kind: "revise" }, { words: "What should change…" }),
            ]
          : [],
        note: buildable ? null : "Couldn't read this plan. Its chat has it.",
      };
    }
    case "prose": {
      // With no read of its own, the card quotes the Cell and offers the kind's fixed ways out.
      const cue = need.prose?.cue ?? "question";
      const text = need.prose?.text ?? null;
      // A question or an offer asks in a sentence of its own; a stop or a step left says the fixed line.
      const asked = text !== null && (cue === "question" || cue === "offer") ? askOf(text) : null;
      return {
        ...base(need),
        headline: asked?.ask ?? PROSE[cue],
        quote: asked === null ? text : asked.context,
        options:
          cue === "question"
            ? [reply("Your answer…"), nothingToDo]
            : cue === "left"
              ? [didIt, reply("Tell it what you did…"), nothingToDo]
              : [goAhead(cue === "stopped"), reply("Tell it what to do…"), nothingToDo],
      };
    }
    case "stuck": {
      const since = Date.parse(need.stuck?.quietSince ?? need.since);
      const minutes = Math.max(1, Math.floor((now - since) / 60_000));
      const tool = need.stuck?.tool ?? null;
      return {
        ...base(need),
        headline:
          tool === null ? `Quiet for ${minutes} min` : `Quiet for ${minutes} min in a tool call`,
        request: tool?.command ?? null,
        quote: tool !== null && tool.command === null ? tool.title : null,
        options: [
          option(
            "nudge",
            "Nudge…",
            { kind: "nudge" },
            {
              consequence: "It reads this without stopping.",
              words: "A word it reads as it goes…",
            },
          ),
          option(
            "stop-and-reply",
            "Stop and reply…",
            { kind: "stopAndReply" },
            {
              consequence: "Stops its turn and starts again from your words.",
              words: "What to do instead…",
            },
          ),
          option(
            "wait",
            "Wait 15 min",
            { kind: "wait" },
            { consequence: "Back here then, if it is still quiet." },
          ),
        ],
        // "Wait 15 min" is this card's later.
        later: false,
      };
    }
  }
}
