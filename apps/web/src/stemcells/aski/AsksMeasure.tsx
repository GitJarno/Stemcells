import { useEffect, useState } from "react";

import { getFromPrimary } from "../upstream/disk";
import { SettingsRow, SettingsSection } from "../upstream/settings";

/** `GET /api/stemcells/asks/measure`, as the server's `asks/ledger.ts` sends it. */
interface Measure {
  readonly days: number;
  readonly kinds: ReadonlyArray<{
    readonly kind: string;
    readonly ended: number;
    readonly alone: number;
    readonly flagged: number;
    readonly whole: boolean;
  }>;
}

const KIND_WORDS: Readonly<Record<string, string>> = {
  permission: "Permissions",
  question: "Questions",
  prose: "Replies that ask or stop short",
  plan: "Plans",
  failed: "Failed runs",
  limit: "Usage limits",
  stuck: "Cells gone quiet",
  "sign-in": "Sign-ins",
  input: "Requests for input",
};

const share = (alone: number, ended: number) => `${alone} of ${ended}`;

/** This week's asks, read once as the page opens; null until it answers, or when it can't. */
function useMeasure(): Measure | null {
  const [measure, setMeasure] = useState<Measure | null>(null);
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Fetch the measure once on mount and drop the answer if it arrives after unmount.
  useEffect(() => {
    let cancelled = false;
    void getFromPrimary("/api/stemcells/asks/measure")
      .then((response) => (response.ok ? (response.json() as Promise<Measure>) : null))
      .catch(() => null)
      .then((next) => {
        if (!cancelled) setMeasure(next);
      });
    return () => {
      cancelled = true;
    };
  }, []);
  return measure;
}

/**
 * Settings › Aski: whether asks say enough to decide (stemcells/tasks/aski-asks.md, decision
 * 12): of the week's asks, the share answered from the ask alone, without opening its chat or
 * flagging it, overall and by kind.
 */
export function AsksMeasure() {
  const measure = useMeasure();
  if (measure === null) return null;
  const ended = measure.kinds.reduce((sum, kind) => sum + kind.ended, 0);
  const alone = measure.kinds.reduce((sum, kind) => sum + kind.alone, 0);
  return (
    <SettingsSection id="aski-asks" title="Whether asks say enough">
      <SettingsRow
        id="aski-asks-alone"
        title="Answered from the ask alone"
        description={`Of the asks that ended in the last ${measure.days} days, the ones you answered without opening their chat or flagging them. When an ask doesn't say enough to decide, flag it: the flag is beside its age. Counted on this Mac only, and sent nowhere.`}
        control={
          <span className="tabular-nums">{ended === 0 ? "No asks yet" : share(alone, ended)}</span>
        }
      />
      {measure.kinds.map((kind) => (
        <SettingsRow
          key={kind.kind}
          id={`aski-asks-${kind.kind}`}
          title={KIND_WORDS[kind.kind] ?? kind.kind}
          description={
            kind.flagged === 0
              ? undefined
              : `${kind.flagged} flagged${kind.whole ? ", so these show the Cell's words whole" : ""}`
          }
          control={<span className="tabular-nums">{share(kind.alone, kind.ended)}</span>}
        />
      ))}
    </SettingsSection>
  );
}
