import { use, useEffect, useState, type ReactNode } from "react";

import type { CellRef } from "../tabs/layout";
import { PaneCellContext } from "../tabs/paneCell";
import { useAutoResume } from "../upstream/limitResume";
import { ComposerBanner } from "../upstream/ui";
import { ContinueNow } from "./ContinueNow";

/**
 * What the banner over a stopped Cell says will happen, for every provider.
 * It names the reset only: a Claude Cell also carries on once the person
 * signs in again, but said at a limit that reads as a way round it (the
 * house rule of 2026-10-14), so the banner leaves it unsaid.
 */
export const CARRIES_ON = "Carries on by itself at the reset.";

/**
 * The reset a stopped Cell waits for, in ms: null when its refusal named
 * none, or named one already past when it came, as neither upstream's worker
 * nor the server waits for either.
 */
export function resetToWaitFor(resetAt: string | null, stoppedAt: string): number | null {
  if (resetAt === null) return null;
  const reset = Date.parse(resetAt);
  return Number.isFinite(reset) && reset > Date.parse(stoppedAt) ? reset : null;
}

/**
 * Whether the reset will carry the Cell on by itself, so the banner says so.
 * With Settings' "Auto-resume limited threads" on, upstream's worker arms
 * each stop and sends upstream's line at its reset (the server's
 * `limitResume.contract.test.ts` pins both), whatever a draft or the
 * server's own refusals say: those hold only the server's sends. Nothing
 * does when the switch is off, the person cancelled it, there is no reset to
 * wait for, or it has passed.
 */
export function carriesOn(at: {
  readonly switchOn: boolean;
  readonly cancelled: boolean;
  readonly reset: number | null;
  readonly now: number;
}): boolean {
  return at.switchOn && !at.cancelled && at.reset !== null && at.now < at.reset;
}

/** The banner's actions: Continue first, then upstream's own, whatever is scheduled. */
export function LimitActions(props: { readonly runId: string; readonly upstream: ReactNode }) {
  return (
    <>
      <ContinueNow runId={props.runId} />
      {props.upstream}
    </>
  );
}

/**
 * Under the banner's row, in a Cell's pane: `CARRIES_ON` while it holds
 * (`carriesOn`), on a line of its own, since the row cuts its own line
 * short to fit the actions.
 */
export function CarriesOnLine(props: {
  readonly cancelled: boolean;
  /** `resetToWaitFor` of the stop. */
  readonly reset: number | null;
}) {
  const cell = use(PaneCellContext);
  if (cell === null || props.cancelled || props.reset === null) return null;
  return <CellCarriesOn reset={props.reset} cell={cell} />;
}

/** The longest a browser timer waits. */
const MAX_TIMER_MS = 2_147_483_647;

function CellCarriesOn(props: { readonly reset: number; readonly cell: CellRef }) {
  const switchOn = useAutoResume(props.cell.environmentId);
  // Read again once the reset passes, so the line goes with it.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (now >= props.reset) return;
    const wait = Math.min(Math.max(props.reset - Date.now(), 0) + 1, MAX_TIMER_MS);
    const timer = window.setTimeout(() => setNow(Date.now()), wait);
    return () => window.clearTimeout(timer);
  }, [props.reset, now]);
  if (!carriesOn({ switchOn, cancelled: false, reset: props.reset, now })) return null;
  return (
    <ComposerBanner.Body className="pe-2 pb-1 text-muted-foreground">
      {CARRIES_ON}
    </ComposerBanner.Body>
  );
}
