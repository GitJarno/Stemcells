/**
 * What an ask carries from the rest of its Cell's reply (stemcells/tasks/unblocking.md,
 * decisions 2 and 4): the reply's opening paragraph, which says what the Cell did, and the
 * links it gave, so a step that says "buy it" sits beside where to buy it. Pure, no model.
 */
import { readCloseOut } from "./closeOut.ts";

export interface Link {
  readonly label: string;
  readonly url: string;
}

export interface Brief {
  /** The reply's opening paragraph, when it isn't what the ask already quotes. */
  readonly lead: string | null;
  /** The reply's web links the ask's own words don't carry, the last few. */
  readonly links: ReadonlyArray<Link>;
}

/** A lead longer than this ends at a sentence or a word, with an ellipsis. */
export const LEAD_CAP = 400;
const LINKS_SHOWN = 3;
const LABEL_CAP = 40;

const FENCE = /^\s*(?:```|~~~)/;
/** A block that isn't a plain paragraph: a heading, list, table, quote or rule. */
const NOT_PROSE = /^\s*(?:#{1,6}\s|[-*+•]\s|\d{1,2}[.)]\s|\||>|---|\*\*\*|___)/;
const MARKDOWN_LINK = /(!?)\[([^\]\n]*)\]\((https?:\/\/[^\s)]+)\)/g;
const BARE_URL = /https?:\/\/[^\s<>()[\]`"']+[^\s<>()[\]`"'.,;:!?]/g;

/** The reply's blocks outside fenced code, in order. */
function blocks(reply: string): ReadonlyArray<string> {
  let inFence = false;
  const kept: string[] = [];
  for (const line of reply.split("\n")) {
    if (FENCE.test(line)) {
      inFence = !inFence;
      kept.push("");
    } else kept.push(inFence ? "" : line);
  }
  return kept
    .join("\n")
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter((block) => block !== "");
}

function capped(text: string): string {
  if (text.length <= LEAD_CAP) return text;
  const head = text.slice(0, LEAD_CAP);
  const sentence = head.search(/[.!?](?=\s[^.!?]*$)/);
  if (sentence > LEAD_CAP / 2) return head.slice(0, sentence + 1);
  return `${head.slice(0, head.lastIndexOf(" ")).trimEnd()}…`;
}

/** A link's name as the Cell gave it; one named by its own address is shortened. */
export function labelOf(label: string, url: string): string {
  const named = label.trim();
  if (named !== "" && !/^(?:https?:\/\/)?[^\s]+\.[a-z]{2,}(?:\/\S*)?$/i.test(named)) return named;
  const parsed = URL.parse(url);
  if (parsed === null) return named || url;
  const short = parsed.host.replace(/^www\./, "") + parsed.pathname.replace(/\/$/, "");
  return short.length <= LABEL_CAP ? short : `${short.slice(0, LABEL_CAP - 1)}…`;
}

/** The reply's web links in the order it gives them, each once; images left out. */
function linksOf(reply: string): ReadonlyArray<Link> {
  const found = new Map<string, Link>();
  for (const block of blocks(reply)) {
    const named = [...block.matchAll(MARKDOWN_LINK)];
    // Blanked to their length, so a bare address keeps its place among the named ones.
    const unnamed = block.replace(MARKDOWN_LINK, (link) => " ".repeat(link.length));
    const all = [
      ...named.flatMap(([, image, label, url], index) =>
        image === "" && url !== undefined
          ? [{ at: named[index]!.index, label: label ?? "", url }]
          : [],
      ),
      ...[...unnamed.matchAll(BARE_URL)].map(([url], index, bare) => ({
        at: bare[index]!.index,
        label: "",
        url,
      })),
    ].toSorted((a, b) => a.at - b.at);
    for (const { label, url } of all) {
      if (!found.has(url)) found.set(url, { label: labelOf(label, url), url });
    }
  }
  return [...found.values()];
}

/**
 * What the ask carries from `reply`, beside `shown`: the words the ask already shows
 * (its quote and steps), which neither the lead nor the links repeat.
 */
export function briefOf(reply: string, shown: ReadonlyArray<string>): Brief {
  const first = blocks(readCloseOut(reply).rest).find((block) => !NOT_PROSE.test(block)) ?? null;
  const lead = first === null || shown.join("\n").includes(first) ? null : capped(first);
  const seen = [...shown, lead ?? ""].join("\n");
  const links = linksOf(reply).filter((link) => !seen.includes(link.url));
  return { lead, links: links.slice(-LINKS_SHOWN) };
}
