/**
 * One plan, as the person reads it (stemcells/tasks/aski-orchestrator.md, decisions 4, 7, 15, 16
 * and 18): a row per Cell (`PlanRow.tsx`), which is a task until the plan is sent. Nothing of it
 * starts before the person's Send, at the card's foot: there they look, change and switch off
 * first. A deletion takes a hand held on its own button, and nothing else does it.
 */
import { type CSSProperties, use, useEffect, useRef, useState } from "react";

import type { DestroyAct } from "../../../../../../stemcells/orchestrator/plan.ts";
import { type CellSeen, flyingOf, rowSays } from "../../../../../../stemcells/orchestrator/rows.ts";
import {
  canDestroy,
  comesAfter,
  counts,
  held,
  onOf,
  type Tray,
  type TrayAct,
  unsendable,
} from "../../../../../../stemcells/orchestrator/tray.ts";
import {
  CANCEL,
  DICTATED,
  DROP,
  FLOOR_LINE,
  headline,
  HOLD_HEARD,
  HOLD_MS,
  HOLD_PRESS,
  HOLD_UNKNOWN,
  holdLine,
  holdStays,
  LEFT_OVER,
  SEND,
  SEND_WAITS,
} from "../../../../../../stemcells/words/plans.ts";
import { useNeeds } from "../../needs/stream";
import { useOwnWorktree, usePlanRows } from "../../upstream/askiPlans";
import { useNowMinuteMs } from "../../upstream/needs";
import { Button } from "../../upstream/ui";
import { PlanRow } from "./PlanRow";
import { runner } from "./PlanRunner";
import { PlanRoom } from "./room";
import { leavePlan, type LivePlan } from "./store";

import "../../rail/cells.css";
import "./plan.css";

export function PlanCard(props: { live: LivePlan }) {
  const { live } = props;
  const tray = live.tray;
  if (tray === null)
    return (
      <section data-aski-plan="" data-reading="" aria-live="polite">
        <header data-plan-head="">{headline(0, 0, 0, true)}</header>
      </section>
    );
  return <Plan live={live} tray={tray} />;
}

function Plan(props: { live: LivePlan; tray: Tray }) {
  const { live, tray } = props;
  const { plan } = tray;
  const { waiting, queued } = counts(tray);
  // Each Cell as the needs list has it, which Awake reads too: a row says what its Cell's row says.
  const { cells: standings } = useNeeds();
  const standingOf = (threadId: string) =>
    standings?.find((cell) => cell.threadId === threadId) ?? null;
  const seenOf = (threadId: string): CellSeen | null => {
    const standing = standingOf(threadId);
    return standing === null
      ? null
      : {
          stage: standing.stage,
          line: standing.line,
          short: standing.landing?.verdict === "short",
        };
  };
  const flying = flyingOf(tray, seenOf);
  const aski = use(PlanRoom);
  const ownWorktree = useOwnWorktree(aski);
  const rows = usePlanRows(aski);
  const now = useNowMinuteMs();
  const cells = tray.acts.filter(
    (one) => one.act.kind === "start" && one.status !== "dropped" && one.status !== "called-back",
  ).length;
  const off = tray.acts.filter((one) => one.off === true).length;
  const holding = held(tray);
  const leftOver = plan.leftOver
    .map((n) => plan.pieces.find((piece) => piece.n === n)?.text ?? "")
    .filter((text) => text.length > 0);
  // The foot stands while a Cell waits for Send. Sent, it folds away as it read at that moment.
  const [foot, setFoot] = useState(waiting > 0 ? tray : null);
  if (waiting > 0 && foot !== tray) setFoot(tray);
  return (
    <section data-aski-plan="" data-source={live.source} aria-label="Aski's plan">
      <header data-plan-head="">
        <span data-plan-headline="" aria-live="polite">
          {plan.from === "floor" ? FLOOR_LINE : headline(cells, flying, off, false, queued)}
        </span>
        {plan.dictated ? <span data-plan-chip="">{DICTATED}</span> : null}
        {/* With nothing left to send, a card that stays over the composer (a Cell didn't start) can still be put away. */}
        {live.source === "message" && foot === null ? (
          <span data-plan-head-actions="">
            <Button
              size="compact"
              variant="ghost-muted"
              aria-label="Close the plan"
              onClick={() => leavePlan(live.id)}
            >
              ×
            </Button>
          </span>
        ) : null}
      </header>
      <ol data-plan-rows="">
        {tray.acts.map((one, index) =>
          one.act.kind === "destroy" ? (
            <HoldRow key={one.act.i} planId={live.id} one={one} act={one.act} />
          ) : (
            <PlanRow
              key={one.act.i}
              planId={live.id}
              environmentId={aski?.environmentId ?? ""}
              one={one}
              act={one.act}
              index={index}
              holding={holding}
              says={rowSays(tray, one, seenOf)}
              // One that comes after another works where that Cell worked, in no worktree of its own.
              apart={
                (one.status === "waiting" ||
                  one.status === "queued" ||
                  one.status === "starting") &&
                !comesAfter(one.act) &&
                ownWorktree(one.act)
              }
              standing={one.status === "started" ? standingOf(one.act.threadId) : null}
              now={now}
              rows={rows}
            />
          ),
        )}
      </ol>
      {leftOver.length > 0 ? <p data-plan-note="">{LEFT_OVER(leftOver.join(" … "))}</p> : null}
      {foot === null ? null : (
        <Foot live={live} tray={foot} leaving={waiting === 0} onGone={() => setFoot(null)} />
      )}
    </section>
  );
}

/**
 * The plan's one yes: Cancel, and Send with how many Cells it starts, at the right. All or
 * nothing: while it can't go, it says why beside it. Enter in the empty composer is the same
 * Send for a message's own plan (`AskiPlans.tsx`); a plan Aski proposed is sent only from here.
 */
function Foot(props: { live: LivePlan; tray: Tray; leaving: boolean; onGone: () => void }) {
  const { live, tray, leaving } = props;
  const waits = unsendable(tray);
  const why =
    waits === "held"
      ? SEND_WAITS.held
      : waits === null || waits === "nothing"
        ? null
        : SEND_WAITS.place;
  return (
    <footer
      data-plan-foot=""
      data-leaving={leaving ? "" : undefined}
      inert={leaving}
      onAnimationEnd={(event) => {
        if (leaving && event.target === event.currentTarget) props.onGone();
      }}
    >
      {why === null ? null : (
        <span data-plan-foot-why="" role="status">
          {why}
        </span>
      )}
      {/* A plan Aski proposed stands in its reply: there is nothing of it to put away. */}
      {live.source === "proposed" ? null : (
        <Button
          size="compact"
          variant="ghost-muted"
          onClick={() => {
            runner.dropAll(live.id);
            leavePlan(live.id);
          }}
        >
          {CANCEL}
        </Button>
      )}
      <Button size="compact" disabled={waits !== null} onClick={() => runner.send(live.id)}>
        {SEND(onOf(tray).length)}
        {live.source === "message" ? (
          <kbd data-plan-key="" aria-hidden>
            ⏎
          </kbd>
        ) : null}
      </Button>
    </footer>
  );
}

/**
 * A deletion. It names the thing as the app writes it, says what stays, and is carried out only
 * by a pointer or a key held on its button for `HOLD_MS`: no Enter, no Send, no message.
 */
function HoldRow(props: { planId: string; one: TrayAct; act: DestroyAct }) {
  const { planId, one, act } = props;
  const [holding, setHolding] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const letGo = () => {
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = null;
    setHolding(false);
  };
  const press = () => {
    if (timer.current !== null) return;
    setHolding(true);
    timer.current = setTimeout(() => {
      letGo();
      void runner.destroy(planId, act.i);
    }, HOLD_MS);
  };
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Clear the hold's timer if the row leaves while a hand is down.
  useEffect(() => () => void (timer.current !== null && clearTimeout(timer.current)), []);
  const known = canDestroy(act);
  const waiting = one.status === "waiting";
  return (
    <li data-plan-row="" data-plan-hold="" data-status={one.status}>
      <div data-plan-hold-line="">
        <strong data-plan-hold-what="">{holdLine(act)}</strong>
        <span data-plan-actions="">
          {waiting && known ? (
            <button
              type="button"
              data-plan-hold-button=""
              data-holding={holding ? "" : undefined}
              style={{ "--plan-hold": `${HOLD_MS}ms` } as CSSProperties}
              onPointerDown={(event) => {
                if (event.button === 0) press();
              }}
              onPointerUp={letGo}
              onPointerLeave={letGo}
              onPointerCancel={letGo}
              onKeyDown={(event) => {
                if ((event.key === " " || event.key === "Enter") && !event.repeat) press();
              }}
              onKeyUp={letGo}
              onBlur={letGo}
              // A click alone does nothing: only the hold.
              onClick={(event) => event.preventDefault()}
            >
              {HOLD_PRESS}
            </button>
          ) : null}
          {waiting ? (
            <Button size="compact" variant="ghost-muted" onClick={() => runner.drop(planId, act.i)}>
              {DROP}
            </Button>
          ) : (
            <span data-plan-status="">{one.status === "done" ? "Done" : "Dropped"}</span>
          )}
        </span>
      </div>
      {waiting ? (
        <p data-plan-note="">
          {known ? `${HOLD_HEARD(act.words)} ${holdStays(act)}` : HOLD_UNKNOWN}
        </p>
      ) : null}
    </li>
  );
}
