/**
 * The risk floor (stemcells/tasks/prompting.md, decision 17): a reading of
 * a message for the acts that can't be taken back, or that reach outside
 * the Mac. It reads verb × object × scope, never with a model, at once and
 * offline: a classifier may add a doubt, never clear one of these.
 * Everyday code chores pass ("delete the unused import", "rm -rf
 * node_modules"). Pure: text in, findings out. Ported from the Swift app's
 * `RiskFloor`, with its match and miss fixtures (`floor.test.ts`).
 *
 * What the floor flags is a question, not a refusal: whoever calls it
 * decides who is asked (`hold.ts`).
 */

export type RiskKind =
  /** Git history: force-push, hard reset, a deleted branch or tag. */
  | "history"
  /** Data or folders gone: rm -rf, a dropped table, a wiped bucket. */
  | "deletion"
  /** Keys, tokens, access: revoked, rotated, shared, made public. */
  | "access"
  /** Words reaching people: an email, a DM, a post to a channel. */
  | "outreach"
  /** Money moving: a purchase, a charge, a refund, a budget raised. */
  | "money"
  /** Out to the world: a deploy to production, a publish, a release. */
  | "release";

/** A stretch of the text, by UTF-16 offsets. */
export interface RiskSpan {
  readonly start: number;
  readonly end: number;
}

/** One risky phrase: the verb through its object, in its sentence. */
export interface RiskFinding extends RiskSpan {
  /** The sentence it stands in, trimmed. */
  readonly sentence: RiskSpan;
  readonly kind: RiskKind;
  /** A negation stands within three words before it, in its clause: "don't force-push". */
  readonly negated: boolean;
}

/** Every risky phrase in `text`, in order, none overlapping. */
export function riskFindings(text: string): RiskFinding[] {
  const out: RiskFinding[] = [];
  for (const sentence of sentencesOf(text)) {
    const within = text.slice(sentence.start, sentence.end);
    const hits: Array<RiskSpan & { readonly kind: RiskKind; readonly rank: number }> = [];
    RULES.forEach((rule, rank) => {
      for (const match of within.matchAll(rule.regex)) {
        const [from, to] = match.indices?.groups?.t ?? [match.index, match.index + match[0].length];
        const start = sentence.start + from;
        const end = sentence.start + to;
        if (end <= start) continue;
        if (rule.verbFirst && !isVerbPosition(text, start, sentence.start)) continue;
        if (rule.veto?.(within, text.slice(end, sentence.end))) continue;
        hits.push({ start, end, kind: rule.kind, rank });
      }
    });
    hits.sort((a, b) => a.start - b.start || a.rank - b.rank);
    const kept: typeof hits = [];
    for (const hit of hits)
      if (!kept.some((k) => k.start < hit.end && hit.start < k.end)) kept.push(hit);
    for (const { start, end, kind } of kept)
      out.push({ start, end, sentence, kind, negated: isNegated(text, start, sentence.start) });
  }
  return out;
}

/**
 * Sentence spans, trimmed: a break at a newline or ";", and at ".", "!" or
 * "?" only when whitespace or the end follows, so ".env", "v2.1" and
 * "console.log" stay inside their sentence.
 */
export function sentencesOf(text: string): RiskSpan[] {
  const out: RiskSpan[] = [];
  let start = 0;
  const close = (end: number) => {
    let a = start;
    let b = end;
    while (a < b && /\s/.test(text[a]!)) a++;
    while (b > a && /\s/.test(text[b - 1]!)) b--;
    if (a < b) out.push({ start: a, end: b });
  };
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!;
    const next = i + 1;
    if (c === "\n" || c === ";") {
      close(i);
      start = next;
    } else if (
      ".!?".includes(c) &&
      (next === text.length || /\s/.test(text[next]!)) &&
      !isListMarker(text.slice(start, i))
    ) {
      close(next);
      start = next;
    }
  }
  close(text.length);
  return out;
}

/** "2." opening a list line is the item's number, not a sentence. */
function isListMarker(s: string): boolean {
  return /^\d{1,3}$/.test(s.replace(/^[ \t]+|[ \t]+$/g, ""));
}

/**
 * Words before which a verb is a noun or an adjective: "the delete
 * button", "a force-push guard", "on delete cascade".
 */
const NOUN_CONTEXT = new Set(
  "the a an this that these those its his her their our my your of for with on in at by from any some every each which what whose no via per".split(
    " ",
  ),
);

/**
 * A verb counts as asked for at a clause's start (the sentence's start,
 * after a bullet, a comma or a colon), or after any word that is not a
 * determiner or a preposition ("then delete", "to delete", "please delete").
 */
function isVerbPosition(text: string, at: number, sentenceStart: number): boolean {
  const before = text.slice(sentenceStart, at).replace(/\s+$/, "");
  const last = before.at(-1);
  if (last === undefined) return true;
  if (/[,:;\-–—()•*>\d]/.test(last)) return true;
  const word = previousWords(before, 1)[0] ?? "";
  if (word.endsWith("'s") || word.endsWith("’s")) return false;
  return !NOUN_CONTEXT.has(word);
}

const NEGATIONS = new Set(
  "not never no without avoid nor dont cant wont shouldnt mustnt doesnt cannot neither refrain".split(
    " ",
  ),
);

/**
 * A negation within three words before the trigger, in its clause: a comma
 * ends a negation's reach, so "No, delete the repo" is asked for. (A list
 * under one "do not" then reads its later items as asked: a question too
 * many, never one too few.)
 */
function isNegated(text: string, at: number, sentenceStart: number): boolean {
  let clause = text.slice(sentenceStart, at);
  const cut = clause.search(/[,:–—][^,:–—]*$/);
  if (cut >= 0) clause = clause.slice(cut + 1);
  return previousWords(clause, 3).some(
    (word) =>
      NEGATIONS.has(word.replace(/['’]/g, "")) || word.endsWith("n't") || word.endsWith("n’t"),
  );
}

/** The last `count` words of `s`, nearest first, lowercased, edge punctuation shed. */
function previousWords(s: string, count: number): string[] {
  return s
    .split(/\s+/)
    .map((word) => word.toLowerCase().replace(/^[,.;:!?()"[\]{}]+|[,.;:!?()"[\]{}]+$/g, ""))
    .filter((word) => word.length > 0)
    .slice(-count)
    .toReversed();
}

// Rules

interface Rule {
  readonly kind: RiskKind;
  readonly regex: RegExp;
  /** The first word is a verb, asked for only in a verb's position. */
  readonly verbFirst: boolean;
  /** Drops a match: (its sentence, the rest of the sentence after it). */
  readonly veto?: (sentence: string, rest: string) => boolean;
}

/**
 * Whether the engine reads `(?-i:…)`, the case-sensitive stretches a name
 * needs ("email Ilse"). One that doesn't reads them case-blind, so the
 * floor asks more often, never less.
 */
const MODIFIERS = (() => {
  try {
    return new RegExp("(?-i:a)", "i").test("a");
  } catch {
    return false;
  }
})();

function rule(
  kind: RiskKind,
  pattern: string,
  options: { readonly verbFirst?: boolean; readonly veto?: Rule["veto"] } = {},
): Rule {
  const source = MODIFIERS ? pattern : pattern.replaceAll("(?-i:", "(?:");
  return {
    kind,
    regex: new RegExp(source, "gid"),
    verbFirst: options.verbFirst ?? true,
    ...(options.veto ? { veto: options.veto } : {}),
  };
}

/**
 * Words that make an act a code chore when they come before the risky
 * object: "delete the unused import in the database layer" never reaches
 * "database".
 */
const SAFE = String.raw`(?:imports?|functions?|func|methods?|class(?:es)?|structs?|enums?|protocols?|tests?|specs?|comments?|lines?|variables?|vars?|constants?|params?|parameters?|arguments?|args?|props?|propert(?:y|ies)|fields?|prints?|statements?|logs?|logging|console\.log|debug|code|dead|unused|duplicates?|duplicated|dependenc(?:y|ies)|packages?|css|styles?|todos?|warnings?|buttons?|views?|components?|sections?|paragraphs?|sentences?|words?|text|copy|caches?|cached|builds?|artifacts?|node_modules|dist|deriveddata|tmp|temp|scratch|worktrees?|whitespace|emojis?|icons?|snippets?|blocks?|hooks?|flags?|options?|entr(?:y|ies)|items?|rows?|placeholders?|labels?|links?|file|headers?|footers?|modals?|screens?|pages?|tabs?|columns?|mocks?|fixtures?|stubs?|simulators?|elements?|attributes?|html|div|span|xml|svg|markup|h[1-6]|images?|assets?|empty|old\s+(?:code|tests?)|stale\s+(?:code|tests?))`;

/** A UI or code noun right after the object makes the object an adjective: "the home button". */
const NOT_AFTER = String.raw`(?!\s+(?:buttons?|pages?|screens?|views?|icons?|tabs?|links?|sections?|headers?|footers?|cards?|rows?|fields?|components?|labels?|menus?|bars?|modals?|names?|switcher|picker|selector|prefix|suffix|filters?|dropdowns?|indicators?|badges?|chips?|pills?|counts?|counter|usage|limits?|length|size|types?|ids?|column|logic|check|checks|handler|helper|model|models|schema|struct|class|test|tests|code|messages?|messaging|lists?|layer|attributes?|template|templates|format|formatting|style)\b)`;

/** A key taken out of a dictionary is code, not a credential. */
const FROM_A_STRUCTURE = String.raw`(?!\s+from\s+(?:the\s+|a\s+|this\s+)?(?:dictionary|dict|map|array|object|json|payload|struct|enum|list|set|tuple|hash|table|query)\b)`;

/** Up to `n` words between a verb and its object, none of them a code chore. */
const gap = (n: number) => String.raw`(?:\s+(?!${SAFE}\b)[^\s]+){0,${n}}?\s+`;

const DELETE_VERBS = String.raw`(?:delete|remove|wipe|erase|purge|destroy|nuke|drop|trash|obliterate|deprovision|decommission|tear\s+down|teardown)`;
const DELETE_OBJECTS = String.raw`(?:repos?|repositor(?:y|ies)|folders?|director(?:y|ies)|dirs?|home|everything|databases?|dbs?|buckets?|records|data|datasets?|collections?|users|accounts?|customers|backups?|projects?|disks?|drives?|volumes?|servers?|instances?|clusters?|environments?|websites?|domains?|workspaces?|organi[sz]ations?|orgs?|inbox(?:es)?|storage|production|prod|trash|tenants?|vms?|droplets?|vaults?|keychain|mailbox(?:es)?|subscribers|contacts|leads|deals|campaigns?|ads|listings|products|catalog|inventory|orders|invoices)`;
const CLEAR_VERBS = String.raw`(?:clear|clear\s+out|clean\s+out|empty|format|overwrite|reset|reinitiali[sz]e)`;
const CLEAR_OBJECTS = String.raw`(?:databases?|dbs?|buckets?|disks?|drives?|volumes?|production|prod|backups?|trash|inbox(?:es)?|records|data|users|accounts?|customers|everything|storage|mailbox(?:es)?)`;
const HISTORY_OBJECTS = String.raw`(?:branch(?:es)?|tags?|commits?|history|stash(?:es)?|remotes?|releases?|reflog)`;
const ACCESS_VERBS = String.raw`(?:revoke|rotate|regenerate|invalidate|reset|delete|remove|disable|deactivate|expire|turn\s+off)`;
const LEAK_VERBS = String.raw`(?:leak|expose|share|publish|post|paste|commit|push|upload|e-?mail|send|print|log)`;
const SECRETS = String.raw`(?:(?:api\s+|ssh\s+|private\s+|access\s+|secret\s+)?keys?|tokens?|credentials?|secrets?|passwords?|passphrases?|\.env|env\s+file|seed\s+phrase|recovery\s+codes?)`;
const ACCESS_OBJECTS = String.raw`(?:(?:api\s+|ssh\s+|private\s+|access\s+|secret\s+)?keys?|tokens?|credentials?|secrets?|passwords?|passphrases?|certificates?|certs?|access|permissions?|admin|2fa|mfa|two-factor|sso|auth|authentication|firewall|branch\s+protection|protection|\.env|env\s+file|seed\s+phrase|recovery\s+codes?|encryption|ssl|tls|https|sandbox|gatekeeper|sip)`;
/** Capitalised words that are services, tools, days or languages, never a person. */
const TECH_NAMES = String.raw`GitHub|GitLab|Git|Stripe|Vercel|Supabase|AWS|API|APIs|Claude|Codex|Xcode|Figma|Linear|Jira|Notion|Sentry|Postgres|Firebase|Google|Apple|Docker|Shopify|Swift|SwiftUI|React|Next|Node|Python|JSON|HTML|CSS|URL|Mac|iPhone|Watch|Safari|Chrome|Terminal|Finder|Stemcells|Aski|Cells?|Main|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|English|Finnish|Swedish|German|Dutch|Italian|Cloudflare|Netlify|Heroku|Redis|Mongo|MongoDB|Sheets|Drive|Gmail|Calendar`;
const RECIPIENTS = String.raw`(?:everyone|everybody|all\s+(?:the\s+|our\s+|my\s+)?(?:customers|clients|subscribers|employees|contacts|members|leads|people|suppliers|partners|users)|(?:our\s+|the\s+|my\s+|all\s+)?(?:customers?|clients?|subscribers|investors?|employees|suppliers?|partners|leads|contacts|candidates|recruiters?|team|whole\s+team|board|press|journalists?|landlord|boss|manager|ceo|cto|founders?|reviewers?|reviews?)|mailing\s+list|the\s+list|#[\w-]+|@[\w.-]+|him|her|them|(?-i:(?!(?:${TECH_NAMES})\b)[A-Z][a-z]{2,}))`;
const CHANNELS = String.raw`(?:slack|twitter|x|linkedin|discord|reddit|facebook|instagram|threads|bluesky|mastodon|hacker\s+news|hn|product\s+hunt|youtube|tiktok|whatsapp|telegram|teams|#[\w-]+|(?:the\s+|our\s+)?(?:[\w-]+\s+)?channel|social(?:\s+media)?|the\s+forum|the\s+community|the\s+blog|our\s+blog|the\s+newsletter|the\s+group\s+chat)`;
const RELEASE_TARGETS = String.raw`(?:prod|production|live|(?:the\s+)?app\s+store|testflight|play\s+store|google\s+play|npm|pypi|crates\.io|rubygems|cocoapods|homebrew|docker\s+hub|the\s+store|the\s+public|main\s+site)`;
const BUILD_ARTIFACTS = new Set([
  "node_modules",
  ".build",
  "build",
  "dist",
  "deriveddata",
  "tmp",
  "/tmp",
  ".next",
  "target",
  "__pycache__",
  ".cache",
  "coverage",
  "out",
  ".turbo",
  ".parcel-cache",
]);

const RULES: readonly Rule[] = [
  // History: phrases that are the act whatever stands around them.
  rule(
    "history",
    String.raw`(?<t>\bforce[- ]?push(?:ed|ing|es)?\b(?!\s+(?:guards?|checks?|protection|hooks?|buttons?|warnings?|detection|rules?|flags?|options?|settings?|tests?|refusal|block)\b)|\bpush\b(?:\s+\S+){0,3}?\s+(?:--force(?:-with-lease)?|-f)(?=\s|$)|\bpush\b\s+(?:it\s+)?with\s+force\b)`,
    { verbFirst: false },
  ),
  rule(
    "history",
    String.raw`(?<t>\breset\s+--hard\b|\bhard\s+reset\b|\bgit\s+branch\s+-D\b|\bpush\s+\S+\s+--delete\b|\bpush\s+origin\s+:\S+|\bfilter-(?:branch|repo)\b)`,
    { verbFirst: false },
  ),
  rule("history", String.raw`(?<t>\brewrite\s+(?:the\s+)?(?:git\s+|commit\s+|repo\s+)?history\b)`),
  rule("history", String.raw`(?<t>\b${DELETE_VERBS}${gap(4)}${HISTORY_OBJECTS}\b)${NOT_AFTER}`),
  // Deletion: shell, SQL and infra commands.
  rule("deletion", String.raw`(?<t>\brm\s+-(?:[a-z]*r[a-z]*f|[a-z]*f[a-z]*r)[a-z]*)`, {
    verbFirst: false,
    veto: (_, rest) => {
      const first = rest.trim().split(/\s+/)[0];
      if (!first) return false;
      let target = first.toLowerCase();
      if (target.startsWith("./")) target = target.slice(2);
      while (target.endsWith("/") && target.length > 1) target = target.slice(0, -1);
      return BUILD_ARTIFACTS.has(target);
    },
  }),
  rule(
    "deletion",
    String.raw`(?<t>\bgit\s+clean\s+-[a-z]*f[a-z]*|\bdrop\s+(?:table|database|schema|collection|keyspace|column|db|view)\b|\btruncate\s+table\b|\btruncate\s+(?:the\s+)?\w+\s+tables?\b|\bdelete\s+from\s+\w+|\bterraform\s+destroy\b|\bkubectl\s+delete\b|\bhelm\s+(?:uninstall|delete)\b|\baws\s+\S+\s+(?:rm|rb|delete-\S+|terminate-\S+)\b|\bgsutil\s+(?:-m\s+)?rm\b|\bgcloud\b[^.;\n]*?\bdelete\b|\bdocker\s+system\s+prune\s+-a\b|\bdropdb\b|\bsupabase\s+db\s+reset\b)`,
    { verbFirst: false },
  ),
  // Deletion in words: "delete everything", "wipe the database", "remove all the files".
  rule(
    "deletion",
    String.raw`(?<t>\b(?:delete|remove|wipe|erase|purge|destroy|nuke|clear|trash)\s+(?:all|every|the\s+entire|the\s+whole|entire|whole)\s+(?:of\s+)?(?:the\s+|my\s+|our\s+|your\s+)?(?:[\w-]+\s+)?(?:files|folders|data|content|contents|code|codebase|history|commits|branches|emails|messages|users|records|rows|tables|repos|projects|photos|documents|notes|posts|products|orders|customers|contacts|leads)\b)`,
  ),
  rule("deletion", String.raw`(?<t>\b${DELETE_VERBS}${gap(4)}${DELETE_OBJECTS}\b)${NOT_AFTER}`),
  rule("deletion", String.raw`(?<t>\b${CLEAR_VERBS}${gap(3)}${CLEAR_OBJECTS}\b)${NOT_AFTER}`),
  // Access.
  rule(
    "access",
    String.raw`(?<t>\b${ACCESS_VERBS}${gap(4)}${ACCESS_OBJECTS}\b)${NOT_AFTER}${FROM_A_STRUCTURE}`,
  ),
  rule(
    "access",
    String.raw`(?<t>\b${LEAK_VERBS}${gap(4)}${SECRETS}\b)${NOT_AFTER}${FROM_A_STRUCTURE}`,
  ),
  rule(
    "access",
    String.raw`(?<t>\bmake\s+(?:the\s+|this\s+|our\s+|my\s+|that\s+)?(?:[\w-]+\s+)?(?:repo|repository|bucket|project|drive|folder|doc|document|sheet|spreadsheet|site|website|page|gist|video|channel|it)\s+public\b)`,
  ),
  rule(
    "access",
    String.raw`(?<t>\bchmod\s+(?:-R\s+)?777\b|\b(?:grant|give)\b(?:\s+\S+){0,5}?\s+(?:admin|owner|root|write|full)\s+(?:access|rights|roles?|permissions?|privileges?)\b)`,
    { verbFirst: false },
  ),
  // Money before outreach: "send $500 to Ilse" is a payment.
  rule(
    "money",
    String.raw`(?<t>\b(?:transfer|wire|send|pay)\s+(?:the\s+)?(?:[$€£]\s?\d[\d,.]*|\d[\d,.]*\s*(?:k|m)?\s*(?:usd|eur|euros?|dollars?|gbp|pounds?)\b|money\b|funds\b|crypto\b|btc\b|eth\b))`,
  ),
  rule(
    "money",
    String.raw`(?<t>\b(?:buy|purchase)(?!-)\s+(?:an?|the|some|more|another|it|them|this|that|these|those|[$€£]?\d[\d,.]*|(?-i:[A-Z]\w+))\b(?:\s+[\w-]+)?)`,
  ),
  rule(
    "money",
    String.raw`(?<t>\bpay\s+(?:for|the|an?|my|our|this|that|him|her|them|invoices?|bills?|[$€£]?\d[\d,.]*|(?-i:[A-Z][a-z]+))\b(?:\s+[\w-]+)?)`,
  ),
  rule(
    "money",
    String.raw`(?<t>\b(?:charge|bill|invoice)\s+(?:the\s+|our\s+|my\s+)?(?:customers?|clients?|users?|cards?|them|him|her|accounts?|[$€£]|\d))`,
  ),
  rule(
    "money",
    String.raw`(?<t>\brefund\s+(?:the|an?|this|that|his|her|their|him|them|all|every|[$€£]?\d[\d,.]*|(?-i:[A-Z][a-z]+))\b(?:\s+[\w-]+)?)`,
  ),
  rule(
    "money",
    String.raw`(?<t>\b(?:subscribe|sign\s+up|upgrade)\b(?:\s+\S+){0,4}?\s+(?:plan|pro|premium|paid|tier|subscription|max|enterprise|seats?)\b)`,
  ),
  rule(
    "money",
    String.raw`(?<t>\b(?:increase|raise|double|triple|bump|set)\s+(?:the\s+|our\s+)?(?:daily\s+|monthly\s+|weekly\s+)?(?:ad\s+|ads\s+|campaign\s+)?(?:budgets?|spend|bids?|cpc)\b)`,
  ),
  rule(
    "money",
    String.raw`(?<t>\bplace\s+(?:an?|the)\s+order\b|\bbook\s+(?:a|the)\s+(?:flight|hotel|ticket|room|table|trip)\b|\btop\s+up\b|\brenew\s+(?:the\s+)?subscription\b)`,
  ),
  // Release.
  rule(
    "release",
    String.raw`(?<t>\b(?:npm|yarn|pnpm)\s+publish\b|\bcargo\s+publish\b|\bgem\s+push\b|\bpod\s+trunk\s+push\b|\btwine\s+upload\b|\bvercel\b[^.;\n]*?--prod\b|\bfly\s+deploy\b|\bfirebase\s+deploy\b|\bgh\s+release\s+create\b|\bxcrun\s+altool\b|\bfastlane\s+(?:release|deliver|pilot|upload)\w*|\bkubectl\s+apply\b|\bterraform\s+apply\b|\bhelm\s+(?:install|upgrade)\b|\bgo(?:es|ing)?\s+live\b)`,
    { verbFirst: false },
  ),
  rule(
    "release",
    String.raw`(?<t>\b(?:deploy|ship|push|release|roll\s+out|rollout|promote|publish|launch|submit|upload)\b(?:\s+\S+){0,5}?\s+(?:to|into|on|in)\s+${RELEASE_TARGETS}\b)`,
  ),
  rule(
    "release",
    String.raw`(?<t>\bdeploy\b(?:\s+(?:it|this|that|everything|now|the\s+[\w-]+))?)`,
    {
      veto: (sentence) =>
        /\b(?:staging|preview|dev|development|local|localhost|test|testing|sandbox|simulator|device|phone|watch|my\s+mac|locally)\b/i.test(
          sentence,
        ),
    },
  ),
  rule(
    "release",
    String.raw`(?<t>\bpublish\b(?:\s+\S+){0,3}?\s+(?:packages?|crates?|gems?|pods?|library|versions?|releases?|app|website|posts?|blog\s+posts?|articles?|pages?|updates?|changelog|newsletter|listings?|ads?|campaigns?|it|them)\b)`,
  ),
  rule(
    "release",
    String.raw`(?<t>\brelease\b(?:\s+\S+){0,3}?\s+(?:v?\d[\w.]*|versions?|app|builds?|updates?|it)\b)`,
  ),
  // Outreach.
  rule(
    "outreach",
    String.raw`(?<t>\b(?:send|shoot|fire\s+off)\s+(?:out\s+)?(?:(?:an?|the|this|that|my|our|your)\s+)?(?:[\w-]+\s+){0,2}?(?:e-?mails?|mail|newsletters?|invites?|invitations?|campaigns?|blasts?|announcements?|sms|text\s+messages?|dms?|tweets?|press\s+release|follow-?ups?|cold\s+emails?)\b)`,
    {
      // "send an email when the order ships" describes a feature.
      veto: (_, rest) =>
        /\b(?:when|whenever|if|once|after|each\s+time|every\s+time)\b/i.test(rest) &&
        !/\bto\b/i.test(rest),
    },
  ),
  rule(
    "outreach",
    String.raw`(?<t>\b(?:e-?mail|dm|message|text|ping|cc|contact|invite)\s+${RECIPIENTS})`,
  ),
  rule(
    "outreach",
    String.raw`(?<t>\b(?:reply|respond|write\s+back|reach\s+out)\s+to\s+${RECIPIENTS})`,
  ),
  rule(
    "outreach",
    String.raw`(?<t>\b(?:send|forward|e-?mail|mail)\b(?:\s+\S+){0,5}?\s+to\s+${RECIPIENTS})`,
  ),
  rule(
    "outreach",
    String.raw`(?<t>\b(?:post|publish|share|tweet|announce|cross-?post|put)\b(?:\s+\S+){0,5}?\s+(?:to|in|on|into)\s+${CHANNELS}\b)`,
  ),
  rule("outreach", String.raw`(?<t>\btweet\b)`),
];
