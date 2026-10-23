import * as Schema from "effect/Schema";

// The short call that predicts the next prompt for a provider with no
// prediction of its own. Its rules are Claude Code's own (the suggestion
// mode of its CLI, 2.1.309): say what the person would type, not what they
// should, in a few words, or nothing.

/** The person's messages the call reads, the last ones. */
export const USER_MESSAGES_READ = 4;
/** The longest of the person's messages it reads, in characters. */
const USER_MESSAGE_MOST = 1_500;
/** The most of the reply it reads, in characters: its end, where the next step is set up. */
const REPLY_MOST = 6_000;
/** The most words a suggestion has. */
const WORDS_MOST = 12;
/** The longest suggestion, in characters. */
const LENGTH_MOST = 100;

export const SuggestionAnswer = Schema.Struct({ suggestion: Schema.String });

const RULES = `You predict the next message a person will type to their coding agent.

Read the person's recent messages and the agent's latest reply, then answer with JSON: {"suggestion": "..."}.

Predict what THEY would type, not what you think they should do. The test: would they think "I was just about to type that"?

Good suggestions are the obvious next step the reply sets up: answering the question it asked, picking the option they would most likely pick, "go ahead", "run the tests", "try it out", "commit this", "open a PR".

Never suggest: thanks or praise ("looks good", "great"), questions back to the agent, the agent's own voice ("Let me...", "I'll..."), ideas they haven't hinted at, more than one sentence.

Write 2 to 12 words, in their language and their style: lowercase if they write lowercase, terse if they are terse.

If the reply ended in an error, or there is no clear next step, answer {"suggestion": ""}.`;

const clip = (text: string, most: number) =>
  text.length <= most ? text : `${text.slice(0, most).trimEnd()}…`;

/** The reply's end, where it sets up what comes next. */
const tail = (text: string, most: number) =>
  text.length <= most ? text : `…${text.slice(text.length - most).trimStart()}`;

export function suggestionPrompt(input: {
  /** Oldest first. */
  readonly userMessages: ReadonlyArray<string>;
  readonly reply: string;
}): string {
  const userMessages = input.userMessages
    .map((message) => clip(message.trim(), USER_MESSAGE_MOST))
    .filter((message) => message.length > 0)
    .slice(-USER_MESSAGES_READ);
  return [
    RULES,
    "",
    "The person's recent messages, oldest first:",
    ...(userMessages.length > 0
      ? userMessages.map((message) => `<message>\n${message}\n</message>`)
      : ["(none)"]),
    "",
    "The agent's latest reply:",
    `<reply>\n${tail(input.reply.trim(), REPLY_MOST)}\n</reply>`,
  ].join("\n");
}

const WRAPPERS = /^(?:<suggestion>|suggestion:|next:|user:)\s*|\s*<\/suggestion>$/giu;
const QUOTES = /^["'`“”‘’]+|["'`“”‘’]+$/gu;
const META = /^(?:none|n\/a|nothing|no suggestion|nothing to suggest|silence|\(none\)|done)\.?$/iu;
const PRAISE =
  /^(?:thanks|thank you|thx|ty|looks good|lgtm|great|perfect|nice|awesome|cool|good job|well done)\b[\s!.]*$/iu;
const AGENT_VOICE =
  /^(?:let me|i'll|i will|i'm going to|here's|here is|you should|you could|sure[,!]|certainly|okay, i)/iu;

/**
 * What the call answered, as the composer may show it; null when it isn't
 * a message the person would send: empty, more than a line or a sentence,
 * too long, praise, or the agent's voice.
 */
export function cleanSuggestion(raw: string): string | null {
  const text = raw.trim().replace(WRAPPERS, "").replace(QUOTES, "").trim();
  if (text.length === 0 || text.length >= LENGTH_MOST) return null;
  if (/[\r\n]/u.test(text) || /^[*#>-]\s/u.test(text)) return null;
  if (text.split(/\s+/u).length > WORDS_MOST) return null;
  // A second sentence: a stop, then more words.
  if (/[.!?]\s+\S/u.test(text)) return null;
  if (META.test(text) || PRAISE.test(text) || AGENT_VOICE.test(text)) return null;
  return text;
}
