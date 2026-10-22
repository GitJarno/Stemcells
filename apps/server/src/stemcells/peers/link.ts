// @effect-diagnostics nodeBuiltinImport:off - A link's tokens are minted, hashed and compared in plain code the routes and tests share; Effect's Crypto has no constant-time compare.
// Linked environments (stemcells/tasks/peers.md, "Across environments"): what
// two Stemcells servers say to each other, and the credentials they say it
// with. A link is a pair of tokens, one minted by each side for the other;
// the side that minted one keeps only its hash.

import * as NodeCrypto from "node:crypto";

import * as Schema from "effect/Schema";

export const PEERS_PATH = "/api/stemcells/peers";

/** The largest request or answer a peer route reads, in bytes: a message and who sent it. */
export const PEER_BODY_MOST = 96_000;
/** The longest message one Cell sends another elsewhere, in characters. */
export const MESSAGE_MOST = 64_000;
/** The most repositories one roster request names. */
export const REPOS_MOST = 32;
/** The most Cells one roster answer lists. */
export const CELLS_MOST = 256;

const Line = (most: number) => Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(most));
// Ids reach a model's text (who's here, the frame): no space, quote or line
// break that could end the sentence they stand in.
const Id = Schema.String.check(
  Schema.isMinLength(1),
  Schema.isMaxLength(256),
  Schema.isPattern(/^[A-Za-z0-9._:%-]+$/),
);

export const RuntimeMode = Schema.Literals([
  "approval-required",
  "auto-accept-edits",
  "auto",
  "full-access",
]);
export const InteractionMode = Schema.Literals(["default", "plan"]);

/** The person asks this environment to let `environmentId` reach it. */
export const Invite = Schema.Struct({ environmentId: Id, label: Line(120) });

/** The person gives this environment the token `environmentId` minted for it, and its address. */
export const Link = Schema.Struct({
  environmentId: Id,
  label: Line(120),
  baseUrl: Line(2048),
  token: Line(256),
});

export const Unlink = Schema.Struct({ environmentId: Id });

/** A linked environment asks who's at work in the repositories it names. */
export const RosterAsk = Schema.Struct({
  repos: Schema.Array(Line(512)).check(Schema.isMaxLength(REPOS_MOST)),
});

/** A Cell at work, as one environment tells another. */
export const RemoteCell = Schema.Struct({
  threadId: Id,
  title: Schema.String.check(Schema.isMaxLength(512)),
  branch: Schema.NullOr(Line(512)),
  status: Line(64),
  repo: Line(512),
  aski: Schema.Boolean,
  at: Schema.Number,
});
export type RemoteCell = typeof RemoteCell.Type;

export const RosterReply = Schema.Struct({
  cells: Schema.Array(RemoteCell).check(Schema.isMaxLength(CELLS_MOST)),
});

export const HelloReply = Schema.Struct({ environmentId: Id });

/** A message from a Cell elsewhere to one here. */
export const Delivery = Schema.Struct({
  from: Schema.Struct({
    threadId: Id,
    title: Schema.String.check(Schema.isMaxLength(512)),
    repo: Line(512),
    runtimeMode: RuntimeMode,
    interactionMode: InteractionMode,
  }),
  to: Id,
  text: Line(MESSAGE_MOST),
  /** The sender's own id for this message: a retry delivers it once. */
  requestId: Id,
});
export type Delivery = typeof Delivery.Type;

export const DeliveryReply = Schema.Struct({
  delivery: Schema.Literals(["started", "steered", "queued", "restarted"]),
});

/** A fresh token: 32 random bytes, URL-safe. */
export const newToken = () => NodeCrypto.randomBytes(32).toString("base64url");

/** What the side that minted a token keeps of it. */
export const hashOf = (token: string) =>
  NodeCrypto.createHash("sha256").update(token).digest("hex");

/** Whether `token` is the one `hash` was made from, in time that doesn't depend on where they differ. */
export function matches(token: string, hash: string): boolean {
  const given = Buffer.from(hashOf(token), "hex");
  const kept = Buffer.from(hash, "hex");
  return given.length === kept.length && NodeCrypto.timingSafeEqual(given, kept);
}

/** The bearer token of an `authorization` header; null for any other. */
export function bearerOf(header: string | undefined): string | null {
  const match = /^Bearer ([A-Za-z0-9_-]{16,256})$/.exec(header ?? "");
  return match === null ? null : match[1]!;
}

/**
 * An environment's address as a linked server calls it: http or https, no
 * credentials, query or fragment, without a trailing slash. Null for anything
 * else.
 */
export function baseUrlOf(raw: string): string | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  if (url.username !== "" || url.password !== "" || url.search !== "" || url.hash !== "")
    return null;
  return `${url.origin}${url.pathname.replace(/\/+$/, "")}`;
}

const MAIL = /^stemcells-peer:([^:]+):([^:]+):[^:]+$/;

/**
 * The id of a message from a Cell elsewhere: the environment that sent it (as
 * its credential proved, not as it said) and the Cell, so every screen and
 * the frame can name both. `nonce` makes it one of a kind.
 */
export const mailId = (environmentId: string, threadId: string, nonce: string) =>
  `stemcells-peer:${encodeURIComponent(environmentId)}:${encodeURIComponent(threadId)}:${encodeURIComponent(nonce)}`;

/** Who sent a message from elsewhere, from its id; null for any other message. */
export function mailOf(
  messageId: string,
): { readonly environmentId: string; readonly threadId: string } | null {
  const match = MAIL.exec(messageId);
  if (match === null) return null;
  try {
    return {
      environmentId: decodeURIComponent(match[1]!),
      threadId: decodeURIComponent(match[2]!),
    };
  } catch {
    return null;
  }
}
