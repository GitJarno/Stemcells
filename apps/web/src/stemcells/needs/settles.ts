/**
 * Every connected machine's settles by hand, as its server streams them
 * (`/api/stemcells/needs/settles/stream`): whole on connect, then whenever one comes or goes.
 * The settled state upstream's shells carry can't say whether a settle was the person's, as
 * upstream's auto-settle leaves a thread just as Settle does; this stream says only that.
 */
import { openEnvironmentStream, subscribeConnectedEnvironments } from "../upstream/needs";
import { followEvents } from "./stream";
import type { HandSettle } from "./wire";

const SETTLES_PATH = "/api/stemcells/needs/settles/stream";

const isSettles = (data: unknown): data is { readonly settles: ReadonlyArray<HandSettle> } => {
  const settles: unknown = (data as { settles?: unknown } | null)?.settles;
  return (
    Array.isArray(settles) &&
    settles.every(
      (settle: { threadId?: unknown; at?: unknown } | null) =>
        typeof settle?.threadId === "string" && typeof settle.at === "string",
    )
  );
};

/** Upstream's server, or a Stemcells one from before the stream, has nothing to follow. */
async function openSettles(environmentId: string, signal: AbortSignal): Promise<Response | null> {
  const response = await openEnvironmentStream(environmentId, SETTLES_PATH, signal);
  if (response?.status !== 404) return response;
  await response.body?.cancel();
  return null;
}

/**
 * Calls `listener` with each connected machine's settles by hand as they stand: on connecting,
 * as they change, and whole again when it comes back from a drop. Returns the stop.
 */
export function subscribeHandSettles(
  listener: (environmentId: string, settles: ReadonlyArray<HandSettle>) => void,
): () => void {
  const following = new Map<string, AbortController>();
  const unsubscribe = subscribeConnectedEnvironments((connected) => {
    for (const [environmentId, stop] of following) {
      if (connected.includes(environmentId)) continue;
      stop.abort();
      following.delete(environmentId);
    }
    for (const environmentId of connected) {
      if (following.has(environmentId)) continue;
      const stop = new AbortController();
      following.set(environmentId, stop);
      void followEvents({
        open: (signal) => openSettles(environmentId, signal),
        accept: isSettles,
        take: (events) => listener(environmentId, events.at(-1)!.settles),
        dropped: () => {},
        signal: stop.signal,
      });
    }
  });
  return () => {
    unsubscribe();
    for (const stop of following.values()) stop.abort();
    following.clear();
  };
}
