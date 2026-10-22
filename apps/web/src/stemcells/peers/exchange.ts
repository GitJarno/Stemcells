// Messages between Cells, as one chat shows them (stemcells/tasks/peers.md,
// decision 4): what came in from another Cell, what this Cell sent with
// `t3_thread_send`, and how they answer each other. All of it reads from
// this chat's own timeline: an ask is a message whose first sentence asks,
// and a reply is the next message back to a Cell with an open ask.

import { resolveT3McpToolId } from "../upstream/t3Tools";

/** What a peer note reads of a timeline entry: upstream's `TimelineEntry`, as far as it goes. */
export type Entry =
  | {
      readonly kind: "message";
      readonly message: {
        readonly id: string;
        readonly role: string;
        readonly text: string;
        readonly senderThreadId?: string | undefined;
      };
    }
  | {
      readonly kind: "work";
      readonly entry: { readonly id: string; readonly structuredPayload?: unknown };
    }
  | { readonly kind: string };

export type Kind = "ask" | "reply" | "says";

/** A message between this Cell and another. */
export interface PeerNote {
  readonly way: "in" | "out";
  /** The other Cell's thread. */
  readonly cell: string;
  readonly kind: Kind;
  readonly gist: string;
  /** The words after the gist; empty when the gist is all of it. */
  readonly rest: string;
  /** A reply's question, in its own gist. */
  readonly answers: string | null;
  /** An ask the other side has written back to since. */
  readonly answered: boolean;
}

/** Longest gist before it is cut at a word; a first sentence a little over still stands whole. */
const GIST_CAP = 90;
const GIST_SLACK = 30;

/** "Otter here." and the like: the card names the sender already. */
const SELF_INTRODUCTION = /^(?:this is\s+)?[\p{L}\p{N}_-]+\s+here\s*[.:,—–-]\s*/iu;

/**
 * A message's gist and the rest: its first sentence (to `.`, `?`, `!` before
 * a space, or a line's end), cut at a word near `GIST_CAP` characters when
 * it runs long.
 */
export function gistOf(text: string): { readonly gist: string; readonly rest: string } {
  const words = text.trim().replace(SELF_INTRODUCTION, "");
  const end = /[.?!](?=\s|$)|\n/.exec(words);
  const sentenceEnd = end === null ? words.length : end.index + (end[0] === "\n" ? 0 : 1);
  if (sentenceEnd <= GIST_CAP + GIST_SLACK) {
    return { gist: words.slice(0, sentenceEnd).trim(), rest: words.slice(sentenceEnd).trim() };
  }
  const cut = words.lastIndexOf(" ", GIST_CAP);
  const at = cut > GIST_CAP / 2 ? cut : GIST_CAP;
  return { gist: `${words.slice(0, at).trim()}…`, rest: `…${words.slice(at).trim()}` };
}

const asks = (gist: string) => gist.endsWith("?");

/** A message another thread sent this one; principals and peers alike. */
export function isFromAnotherCell(message: {
  readonly role: string;
  readonly senderThreadId?: string | undefined;
}): message is { readonly role: string; readonly senderThreadId: string } {
  return message.role === "user" && message.senderThreadId !== undefined;
}

/** What this Cell sent another with `t3_thread_send`; null for any other tool call. */
export function sentOf(payload: unknown): { readonly to: string; readonly text: string } | null {
  if (typeof payload !== "object" || payload === null) return null;
  const item = payload as {
    readonly type?: unknown;
    readonly toolName?: unknown;
    readonly status?: unknown;
    readonly input?: unknown;
  };
  if (item.type !== "dynamic_tool" || typeof item.toolName !== "string") return null;
  if (resolveT3McpToolId(item.toolName) !== "t3_thread_send" || item.status === "failed")
    return null;
  const input = item.input as { readonly threadId?: unknown; readonly message?: unknown } | null;
  if (typeof input?.threadId !== "string" || typeof input.message !== "string") return null;
  return { to: input.threadId, text: input.message };
}

interface Draft {
  way: "in" | "out";
  cell: string;
  kind: Kind;
  gist: string;
  rest: string;
  answers: string | null;
  answered: boolean;
}

/**
 * Every peer note in a chat, by the id of its message (in) or its tool call
 * (out), in the order the chat shows them.
 */
export function exchangeOf(entries: ReadonlyArray<Entry>): ReadonlyMap<string, PeerNote> {
  const notes = new Map<string, Draft>();
  // Per other Cell, the ask still waiting on each side.
  const askedUs = new Map<string, Draft>();
  const weAsked = new Map<string, Draft>();
  for (const entry of entries) {
    let id: string;
    let note: Draft;
    if (entry.kind === "message" && "message" in entry && isFromAnotherCell(entry.message)) {
      id = entry.message.id;
      note = {
        way: "in",
        cell: entry.message.senderThreadId,
        kind: "says",
        answers: null,
        answered: false,
        ...gistOf(entry.message.text),
      };
    } else if (entry.kind === "work" && "entry" in entry) {
      const sent = sentOf(entry.entry.structuredPayload);
      if (sent === null) continue;
      id = entry.entry.id;
      note = {
        way: "out",
        cell: sent.to,
        kind: "says",
        answers: null,
        answered: false,
        ...gistOf(sent.text),
      };
    } else continue;

    const theirs = note.way === "in" ? weAsked : askedUs;
    const open = theirs.get(note.cell);
    if (open !== undefined) {
      note.kind = "reply";
      note.answers = open.gist;
      open.answered = true;
      theirs.delete(note.cell);
    } else if (asks(note.gist)) {
      note.kind = "ask";
      (note.way === "in" ? askedUs : weAsked).set(note.cell, note);
    }
    notes.set(id, note);
  }
  return notes;
}
