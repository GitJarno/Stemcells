import { useEffect, useState } from "react";

import { getFromPrimary, usePrimaryEnvironmentId } from "../upstream/disk";
import type { Spend } from "./lineage";

/** `GET /api/stemcells/spend`, as the server sends it. */
interface SpendReading {
  /** When the first counted turn started; the chats before it were never counted. */
  readonly since: string | null;
  readonly threads: Readonly<Record<string, Spend>>;
}

/**
 * What each chat on this machine has spent, by its life's key, read once as
 * the page opens. Chats on another machine have none here: each counts its
 * own. Null until it answers, or when it can't.
 */
export function useSpend(): {
  readonly since: number | null;
  readonly byKey: ReadonlyMap<string, Spend>;
} | null {
  const primaryId = usePrimaryEnvironmentId();
  const [reading, setReading] = useState<SpendReading | null>(null);
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Fetch the spend once on mount and drop the answer if it arrives after unmount.
  useEffect(() => {
    let cancelled = false;
    void getFromPrimary("/api/stemcells/spend")
      .then((response) => (response.ok ? (response.json() as Promise<SpendReading>) : null))
      .catch(() => null)
      .then((next) => {
        if (!cancelled) setReading(next);
      });
    return () => {
      cancelled = true;
    };
  }, []);
  if (reading === null || primaryId === null) return null;
  const since = reading.since === null ? Number.NaN : Date.parse(reading.since);
  return {
    since: Number.isFinite(since) ? since : null,
    byKey: new Map(
      Object.entries(reading.threads).map(([threadId, spend]) => [
        `${primaryId}:${threadId}`,
        spend,
      ]),
    ),
  };
}
