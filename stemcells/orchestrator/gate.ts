// Which part of Aski gets a message (stemcells/tasks/aski-orchestrator.md, decision 1), decided
// by code at once: any sign of setting something up sends it to the compiler, which hands back
// whatever is talk. The test leans toward the compiler: a miss there costs a second, and a
// miss the other way leaves the person's Cells unstarted.

/** Cells by the words people use for them. */
const CELL = String.raw`(?:cells?|agents?|sessions?|workers?)`;
const COUNT = String.raw`(?:\d{1,2}|a|an|one|two|three|four|five|six|seven|eight|nine|ten|another|some|few|couple)`;
const ORDINAL = String.raw`(?:first|second|third|fourth|fifth|next|other|last)`;

const SIGNS: readonly RegExp[] = [
  // "spawn", "spin up", "kick off": words for starting that mean little else.
  /\b(?:spawn|spin\s+up|kick\s+off|fire\s+up)\b/iu,
  // "start three agents", "launch a cell", "run 2 agents".
  new RegExp(String.raw`\b(?:start|launch|run|create|make|open|need|want|give\s+me|get\s+me|do|have)\s+(?:me\s+)?(?:up\s+)?${COUNT}\s+(?:\S+\s+){0,2}?${CELL}\b`, "iu"),
  // "2 Sol agents", "one agent for", "a Fable cell on high".
  new RegExp(String.raw`\b${COUNT}\s+(?:\S+\s+){0,2}?${CELL}\s+(?:for|to|in|on|with|that|which|about)\b`, "iu"),
  // "agent for the docs", "cell on high": the noun with its task or its setup.
  new RegExp(String.raw`\b${CELL}\s+(?:for|on\s+(?:low|medium|high|max|xhigh))\b`, "iu"),
  // "one for the header, the second for the docs".
  new RegExp(String.raw`\b(?:one|another)\s+(?:for|to|in)\b[\s\S]*\b(?:(?:the\s+)?${ORDINAL}|another|one)\s+(?:one\s+)?(?:for|to|in)\b`, "iu"),
  // A project that doesn't exist yet.
  /\b(?:new|another)\s+project\b|\bcreate\s+(?:a\s+)?project\b/iu,
  // Deleting a project or Cells: the compiler holds these (decision 7).
  new RegExp(String.raw`\b(?:delete|remove|archive|destroy|wipe|nuke|get\s+rid\s+of|trash)\s+(?:\S+\s+){0,4}?(?:projects?|${CELL}|chats?)\b`, "iu"),
];

/** A question about how things stand ("how many cells are flying?") is talk, whatever nouns it has. */
const QUESTION =
  /^\s*(?:hey\s+|ok\s+|so\s+)?(?:how|what|what's|whats|where|when|which|who|why|is|are|was|were|did|does|do\s+(?:we|i|you)\s+have|have\s+(?:we|you|i)|can\s+you\s+(?:tell|show|summari[sz]e|find|list|explain)|could\s+you\s+(?:tell|show|summari[sz]e|find|list|explain)|tell\s+me|show\s+me|summari[sz]e|recap)\b/iu;

/** Words for starting, which make even a question a request: "can you start two agents…?" */
const LAUNCH = /\b(?:spawn|spin\s+up|kick\s+off|fire\s+up|start|launch|create|delete|archive|remove)\b/iu;

/**
 * Whether the compiler should read `text`. `names` are words that set a Cell up on their own:
 * the models' names and the projects' names, lowercased ("fable", "harbor"). A message that
 * opens with one ("Harbor fix the header", "Sol: write the docs") is read too.
 */
export function wantsCompiler(text: string, names: ReadonlySet<string> = new Set()): boolean {
  const words = text.trim();
  if (words.length === 0 || words.startsWith("/")) return false;
  const signed = SIGNS.some((sign) => sign.test(words));
  if (QUESTION.test(words) && !(signed && LAUNCH.test(words))) return false;
  if (signed) return true;
  const opening = words
    .toLowerCase()
    .replace(/^(?:hey|ok|okay|please|so)[\s,]+/u, "")
    .split(/[\s:,]+/u)
    .slice(0, 3);
  // "Harbor fix…", "Harbor Design: …": the first word, or the first two or three as one name.
  return [1, 2, 3].some((n) => opening.length >= n && names.has(opening.slice(0, n).join(" ")));
}
