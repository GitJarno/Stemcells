// @effect-diagnostics nodeBuiltinImport:off - Plain async over node:fs and undici: bytes stream from a file or the network straight into the attachment store, never through a page.
import * as NodeCrypto from "node:crypto";
import * as NodeFS from "node:fs";
import * as NodeFSP from "node:fs/promises";
import * as NodeModule from "node:module";
import * as NodeNet from "node:net";
import * as NodePath from "node:path";
import * as NodeStream from "node:stream";
import * as NodeStreamPromises from "node:stream/promises";

import type * as Undici from "undici";

import { isPictureType, publicAddresses, typeOfName } from "../upstream/attachments.ts";

// Bringing a file another chat shows into a chat's draft, as an attachment
// of its own: a copy in the attachment store, made here on the machine that
// keeps the file, so a video never passes through a page. A remote address
// is fetched once, into the store, never into the person's project, and
// only from the public internet: never this machine, its network, or a
// cloud's metadata address, however a name or a redirect points there.

/** Something to bring in: what it is called, its type, its size when known, and its bytes from the start. */
export interface Incoming {
  readonly name: string;
  readonly mimeType: string;
  readonly size: number | null;
  readonly open: () => NodeStream.Readable;
  /** Lets go of bytes that won't be read (a body still arriving). */
  readonly discard: () => void;
}

/** Why something wasn't brought in, in a few words a person reads. */
export interface Refusal {
  readonly ok: false;
  readonly status: 400 | 404 | 413 | 415 | 502 | 503 | 507;
  readonly reason: string;
}

export interface Stored {
  readonly ok: true;
  readonly attachmentId: string;
  readonly name: string;
  readonly mimeType: string;
  readonly sizeBytes: number;
}

export interface Picture {
  readonly ok: true;
  readonly bytes: Buffer;
  readonly name: string;
  readonly mimeType: string;
}

/** How long a remote address has to answer and send all its bytes. */
export const FETCH_TIMEOUT_MS = 60_000;
/** How many redirects a remote address may take before it is given up on. */
export const MAX_REDIRECTS = 5;

const refuse = (status: Refusal["status"], reason: string): Refusal => ({
  ok: false,
  status,
  reason,
});

/** "Over 50 MB": a cap, as the reason says it. */
export const tooBig = (cap: number) => refuse(413, `Over ${Math.round(cap / (1024 * 1024))} MB`);

/**
 * One answer for a remote address that is refused, unreachable or failing,
 * so what comes back says nothing about what is behind it.
 */
export const unfetched = () => refuse(502, "Couldn't fetch it");

/**
 * A name fit to keep: its last part, without control characters, at most
 * 200 characters. Null when nothing is left.
 */
export function cleanName(name: string | undefined): string | null {
  const last = (name ?? "").split(/[/\\]/).at(-1) ?? "";
  // oxlint-disable-next-line no-control-regex -- control characters are what this removes.
  const clean = last.replace(/[\u0000-\u001f\u007f]/g, "").trim();
  return clean === "" ? null : clean.slice(0, 200);
}

class OverCap extends Error {}

/** Passes bytes through until more than `cap` have gone by. */
function capped(cap: number): {
  readonly stream: NodeStream.Transform;
  readonly bytes: () => number;
} {
  let seen = 0;
  const stream = new NodeStream.Transform({
    transform(chunk: Buffer, _encoding, done) {
      seen += chunk.byteLength;
      if (seen > cap) done(new OverCap());
      else done(null, chunk);
    },
  });
  return { stream, bytes: () => seen };
}

/**
 * Writes `incoming` to `to.path` through a part file (upstream sweeps part
 * files left behind), at most `cap` bytes: an attachment of its own,
 * pending until a message names it. `signal` stops it, leaving nothing.
 */
export async function store(
  incoming: Incoming,
  to: { readonly attachmentId: string; readonly path: string },
  cap: number,
  signal?: AbortSignal,
): Promise<Stored | Refusal> {
  if (incoming.size !== null && incoming.size > cap) {
    incoming.discard();
    return tooBig(cap);
  }
  const part = `${to.path}.${NodeCrypto.randomUUID()}.part`;
  const counter = capped(cap);
  try {
    await NodeFSP.mkdir(NodePath.dirname(to.path), { recursive: true });
    await NodeStreamPromises.pipeline(
      incoming.open(),
      counter.stream,
      NodeFS.createWriteStream(part),
      signal ? { signal } : {},
    );
    await NodeFSP.rename(part, to.path);
    return {
      ok: true,
      attachmentId: to.attachmentId,
      name: incoming.name,
      mimeType: incoming.mimeType,
      sizeBytes: counter.bytes(),
    };
  } catch (error) {
    incoming.discard();
    if (error instanceof OverCap) return tooBig(cap);
    return refuse(502, "Couldn't copy it");
  } finally {
    await NodeFSP.rm(part, { force: true });
  }
}

/** Reads a picture of a type a model is sent, at most `cap` bytes. */
export async function readPicture(
  incoming: Incoming,
  cap: number,
  signal?: AbortSignal,
): Promise<Picture | Refusal> {
  if (!isPictureType(incoming.mimeType)) {
    incoming.discard();
    return refuse(415, "Not a PNG, JPEG, GIF or WebP");
  }
  if (incoming.size !== null && incoming.size > cap) {
    incoming.discard();
    return tooBig(cap);
  }
  const counter = capped(cap);
  const chunks: Buffer[] = [];
  try {
    // A pipeline, so an error anywhere (a reset, a timeout, too many bytes)
    // ends it here rather than unheard on a stream.
    await NodeStreamPromises.pipeline(
      incoming.open(),
      counter.stream,
      async function (source: AsyncIterable<Buffer>) {
        for await (const chunk of source) chunks.push(chunk);
      },
      signal ? { signal } : {},
    );
  } catch (error) {
    incoming.discard();
    if (error instanceof OverCap) return tooBig(cap);
    return unfetched();
  }
  return {
    ok: true,
    bytes: Buffer.concat(chunks),
    name: incoming.name,
    mimeType: incoming.mimeType,
  };
}

/** Where a name may be connected to: its public addresses, or none. */
export type Resolve = (
  host: string,
) => Promise<ReadonlyArray<{ readonly address: string; readonly family: number }> | undefined>;

// undici stays external to the CLI bundle; inside a Node single executable
// only `require` loads it from disk (as upstream's `outboundHttp.ts` does).
const requireUndici = NodeModule.createRequire(import.meta.url);
const agents = new WeakMap<Resolve, Undici.Agent>();

/**
 * An agent that connects only to the addresses `resolve` allows: the check
 * and the connection use the one lookup, so a name that answers differently
 * the second time (DNS rebinding) reaches nothing new.
 */
function agentFor(resolve: Resolve): Undici.Agent {
  let agent = agents.get(resolve);
  if (agent === undefined) {
    const undici = requireUndici("undici") as typeof Undici;
    agent = new undici.Agent({
      allowH2: false,
      connect: {
        lookup: (hostname, options, callback) => {
          void resolve(hostname).then(
            (addresses) => {
              const first = addresses?.[0];
              if (addresses === undefined || first === undefined) {
                callback(new Error("Not a public address"), "", 0);
              } else if (options.all) {
                (callback as unknown as (error: null, all: typeof addresses) => void)(
                  null,
                  addresses,
                );
              } else {
                callback(null, first.address, first.family);
              }
            },
            (error: Error) => callback(error, "", 0),
          );
        },
      },
    });
    agents.set(resolve, agent);
  }
  return agent;
}

const REDIRECTS = new Set([301, 302, 303, 307, 308]);

/** A web address's host as it is connected to, without an IPv6 literal's brackets. */
const hostOf = (url: URL) => url.hostname.replace(/^\[(.*)\]$/, "$1");

/**
 * What a public web address answers with, ready to bring in once: followed
 * by hand through at most `MAX_REDIRECTS` redirects, each checked again. A
 * refusal when it isn't a web address, says it is bigger than `cap`, or
 * isn't fetched (one answer for every way that happens).
 */
export async function fromAddress(
  address: string,
  cap: number,
  options: {
    readonly resolve?: Resolve;
    readonly timeoutMs?: number;
    readonly signal?: AbortSignal;
  } = {},
): Promise<Incoming | Refusal> {
  let url: URL;
  try {
    url = new URL(address);
  } catch {
    return refuse(400, "Not a web address");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return refuse(400, "Not a web address");
  }
  const resolve = options.resolve ?? publicAddresses;
  const signal = AbortSignal.any([
    AbortSignal.timeout(options.timeoutMs ?? FETCH_TIMEOUT_MS),
    ...(options.signal ? [options.signal] : []),
  ]);
  const undici = requireUndici("undici") as typeof Undici;

  let response: Undici.Response;
  for (let hop = 0; ; hop += 1) {
    if (url.protocol !== "http:" && url.protocol !== "https:") return unfetched();
    // An address connects without a lookup, so it is checked here; a name
    // is checked by the lookup it connects through.
    if (NodeNet.isIP(hostOf(url)) !== 0 && (await resolve(hostOf(url))) === undefined)
      return unfetched();
    try {
      response = await undici.fetch(url, {
        dispatcher: agentFor(resolve),
        redirect: "manual",
        signal,
      });
    } catch {
      return unfetched();
    }
    if (!REDIRECTS.has(response.status)) break;
    const location = response.headers.get("location");
    await response.body?.cancel().catch(() => {});
    if (location === null || hop >= MAX_REDIRECTS) return unfetched();
    try {
      url = new URL(location, url);
    } catch {
      return unfetched();
    }
  }

  const body = response.body;
  const discard = () => void body?.cancel().catch(() => {});
  if (!response.ok || body === null) {
    discard();
    return unfetched();
  }
  const length = Number(response.headers.get("content-length"));
  if (Number.isFinite(length) && length > cap) {
    discard();
    return tooBig(cap);
  }
  const name = cleanName(safeDecode(url.pathname.split("/").at(-1))) ?? url.hostname;
  const declared = (response.headers.get("content-type") ?? "").split(";")[0]!.trim().toLowerCase();
  const mimeType =
    declared === "" || declared === "application/octet-stream"
      ? (typeOfName(name) ?? "application/octet-stream")
      : declared;
  return {
    name,
    mimeType,
    size: Number.isFinite(length) && length > 0 ? length : null,
    open: () =>
      NodeStream.Readable.fromWeb(body as Parameters<typeof NodeStream.Readable.fromWeb>[0]),
    discard,
  };
}

function safeDecode(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
