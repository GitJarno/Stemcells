import { useEffect, useState } from "react";

import type { Fact, LedgerPage } from "../../../../../stemcells/ledger/facts.ts";
import { type Award, marksByThread } from "../../../../../stemcells/ledger/marks.ts";
import { getFromPrimary, usePrimaryEnvironmentId } from "../upstream/disk";
import type { Life } from "./lineage";

/** The chats one request asks the ledger for, well under what it takes. */
const CHATS_PER_READ = 100;

/** These chats' facts from the primary machine's ledger (`GET /api/stemcells/ledger`), every page. */
async function readFacts(threadIds: readonly string[]): Promise<Fact[]> {
  const facts: Fact[] = [];
  for (let from = 0; from < threadIds.length; from += CHATS_PER_READ) {
    const threads = threadIds.slice(from, from + CHATS_PER_READ).join(",");
    let after: number | null = 0;
    while (after !== null) {
      const response = await getFromPrimary("/api/stemcells/ledger", {
        threads,
        after: String(after),
      });
      if (!response.ok) throw new Error(`The ledger answered ${response.status}`);
      const page = (await response.json()) as LedgerPage;
      facts.push(...page.facts);
      after = page.next;
    }
  }
  return facts;
}

const NONE: ReadonlyMap<string, readonly Award[]> = new Map();

/**
 * The marks these lives earned, by each life's key, worked out from this machine's ledger as
 * their card opens. Lives on another machine have none here: each keeps its own ledger. None
 * until the ledger answers, or when it can't.
 */
export function useMarks(lives: readonly Life[]): ReadonlyMap<string, readonly Award[]> {
  const primaryId = usePrimaryEnvironmentId();
  const asked =
    primaryId === null
      ? ""
      : lives
          .flatMap((life) => (life.key === `${primaryId}:${life.threadId}` ? [life.threadId] : []))
          .join(",");
  const [read, setRead] = useState<{
    readonly asked: string;
    readonly marks: ReadonlyMap<string, readonly Award[]>;
  } | null>(null);
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Fetch the lives' facts as their card opens and drop the answer if it arrives after it closes.
  useEffect(() => {
    if (asked === "") return;
    let cancelled = false;
    void readFacts(asked.split(","))
      .then((facts) => marksByThread(facts))
      .catch(() => null)
      .then((marks) => {
        if (!cancelled && marks !== null) setRead({ asked, marks });
      });
    return () => {
      cancelled = true;
    };
  }, [asked]);
  if (primaryId === null || read === null || read.asked !== asked) return NONE;
  return new Map([...read.marks].map(([threadId, awards]) => [`${primaryId}:${threadId}`, awards]));
}
