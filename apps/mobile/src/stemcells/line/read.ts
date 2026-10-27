// A machine's asks and its Cells' stages, read from its own server (`GET /api/stemcells/needs`)
// with the bearer token the phone paired with, as push registers (`push/register.ts`). T3's
// relay has no bearer token and Stemcells never pairs through it, so a machine reached that
// way, or one without the endpoint, has no line: the home keeps T3's tabs for it.

import { needsListOf, type NeedsList } from "./kit";

export type Reading =
  /** Its asks and stages, as the server last said. */
  | { readonly state: "read"; readonly list: NeedsList }
  /** Not a Stemcells server, reached through T3's relay, or paired without a bearer token. */
  | { readonly state: "none" }
  /** Out of reach just now; what it said last, if anything, stands. */
  | { readonly state: "unreachable"; readonly list: NeedsList | null };

/** A saved connection as the reader reads it. */
export interface NeedsConnection {
  readonly httpBaseUrl: string;
  readonly bearerToken: string | null;
  readonly relayManaged?: true;
}

const PATH = "/api/stemcells/needs";
/** A machine asleep behind its tailnet can hold a request open; the next reason to read tries again. */
const GIVE_UP_MS = 10_000;

/** Reads one machine; `last` is what it said before, kept while it is out of reach. */
export async function readNeeds(
  connection: NeedsConnection,
  last: NeedsList | null,
  request: typeof fetch = fetch,
): Promise<Reading> {
  if (connection.relayManaged === true || connection.bearerToken === null) return { state: "none" };
  const away: Reading = { state: "unreachable", list: last };
  let url: string;
  try {
    url = new URL(PATH, connection.httpBaseUrl).toString();
  } catch {
    return away;
  }
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), GIVE_UP_MS);
  try {
    const answer = await request(url, {
      headers: { authorization: `Bearer ${connection.bearerToken}` },
      signal: abort.signal,
    });
    // Upstream's server, or a Stemcells one from before the line.
    if (answer.status === 404) return { state: "none" };
    if (!answer.ok) return away;
    const list = needsListOf(await answer.json());
    // A server from before the Cells' stages has no line to stand on.
    return list?.cells === undefined ? { state: "none" } : { state: "read", list };
  } catch {
    return away;
  } finally {
    clearTimeout(timer);
  }
}
