/**
 * Whether a message in Aski's chat asks about the past, and the free words it asks with
 * (stemcells/tasks/aski-orchestrator.md, decision 8). It leans toward no: pills under a message
 * that asked nothing are junk. English only. Pure, and the phone runs it: no newer built-ins.
 */
import { readWhen } from "./when.ts";

/** A question about what was done, or where it was done, whatever its time. */
const FORMS: ReadonlyArray<RegExp> = [
  /\bwhere (?:was|were|did)\b/i,
  /\bwhere (?:is|are|'s) (?:that|the|my|our) (?:[\w'-]+ ){0,3}?(?:chat|cell|session|thread|conversation)s?\b/i,
  /\bwhich (?:chat|cell|session|thread|conversation|one)\b/i,
  /\bwhat (?:happened|came of|became of|got done|was done|did (?:we|i|you|they)|have (?:we|i) (?:done|shipped|built|made)|were we)\b/i,
  /\bwhat(?:'s| is| has) been (?:done|happening|going on)\b/i,
  /\b(?:did|have) we\b/i,
  /\bsummari[sz]e\b|\bsummary of\b|\brecap\b|\bcatch me up\b/i,
  /\b(?:find|pull up|show me|dig up|look up|open) (?:me )?(?:that|the|my|our|a) (?:[\w'-]+ ){0,3}?(?:chat|cell|session|thread|conversation)\b/i,
  /\b(?:that|the) (?:chat|cell|session|conversation) (?:about|where|on|for|with|from)\b/i,
];

/** How a question starts, when it carries no question mark: dictation writes none. */
const ASKS =
  /(?:^|[.!?\n]\s*)(?:and |so |ok(?:ay)?,? |hey,? |aski,? )*(?:what|where|which|when|who|how|did|do|does|have|has|is|are|was|were|anything|any|show|find|list|give me|pull up|tell me|can you (?:show|find|list|tell))\b/i;

/** Whether the message reads as a question about past work. */
export function asksAboutPast(text: string, now: number): boolean {
  if (text.length > 600) return false;
  if (FORMS.some((form) => form.test(text))) return true;
  return readWhen(text, now) !== null && (text.includes("?") || ASKS.test(text));
}

/** Words a question is built from, which say nothing of what it is about. */
export const FILLER: ReadonlySet<string> = new Set(
  (
    "a an the this that these those it its is are was were be been am do does did done doing have has had " +
    "i we you they me my our your us them he she of in on at to for from with about by as and or but so if " +
    "then than not no yes what whats where which when who whom how why there here can could would should " +
    "will shall may might must please just also again ever already actually really some any all each every " +
    "one ones thing things stuff something anything chat chats cell cells session sessions thread threads " +
    "conversation conversations agent agents aski happened happen happening came come become became went " +
    "go going got get made make worked work working left status summarise summarize summary recap digest " +
    "find show tell give list pull up look open remember recall know ago back last past recently lately " +
    "today yesterday week weeks month months day days time now out into over like think believe guess " +
    "kind sort called named project projects repo repository catch been its s t ve re ll d m"
  ).split(" "),
);

/** The most free words a question is searched with. */
const MOST_WORDS = 8;

/** The text with a span of it (a time's words, a project's) taken out. */
export function cut(
  text: string,
  span: { readonly heard: string; readonly at: number } | null,
): string {
  if (span === null) return text;
  return `${text.slice(0, span.at)} ${text.slice(span.at + span.heard.length)}`;
}

/**
 * The free words of a question: what is left of it without the filler, once the time's words
 * and the project's are cut. Lower case, each once, in the order said.
 */
export function freeWords(text: string): ReadonlyArray<string> {
  const words: string[] = [];
  for (const match of text.toLowerCase().matchAll(/[\p{L}\p{N}]+/gu)) {
    const word = match[0];
    if (word.length < 2 || FILLER.has(word) || words.includes(word)) continue;
    words.push(word);
    if (words.length === MOST_WORDS) break;
  }
  return words;
}

/** What a client asks recall for a message: its words, and the window its own clock reads. */
export interface RecallAsk {
  readonly query: string;
  readonly from: number | null;
  readonly to: number | null;
}

/** The recall a message asks for, or null when it doesn't read as a question about the past. */
export function recallAskOf(text: string, now: number): RecallAsk | null {
  if (!asksAboutPast(text, now)) return null;
  const when = readWhen(text, now);
  return { query: text.trim(), from: when?.from ?? null, to: when?.to ?? null };
}
