import type { ReactNode } from "react";

import { path, SIZE } from "../cell/look";
import { brandTokenOf } from "../tokens/providers";
import {
  bindingOf,
  boardOrder,
  type PlanReading,
  type PlanRow,
  type PlanTone,
  ringFigure,
  standingOf,
  windowWhen,
} from "./plans";
import "./limits.css";

const CELL = path("awake");
const RADIUS = 11.5;
const CIRCLE = 2 * Math.PI * RADIUS;

/** A plan's ink: its provider's colour while there is room, amber when short, red when out. */
export function inkOf(driver: string, tone: PlanTone): string {
  if (tone === "out") return "var(--sc-error)";
  if (tone === "short") return "var(--sc-needs-you)";
  const token = brandTokenOf(driver);
  return token === null ? "var(--sc-dim)" : `var(${token})`;
}

type BoardSize = "card" | "page";

export interface Clocks {
  readonly now: number;
  /** "15.40", or "Tue 10.00" once it isn't today. */
  readonly clock: (at: number) => string;
  /** "2h 25m". */
  readonly duration: (ms: number) => string;
}

/** A window: its name, when it resets or runs out, and the percent used over its bar. */
function Row(props: { driver: string; row: PlanRow; clocks: Clocks; size: BoardSize }) {
  const { reading } = props.row;
  const { now, clock, duration } = props.clocks;
  const used = 100 - reading.left;
  const even = reading.evenLeft === null ? null : 100 - reading.evenLeft;
  return (
    <li
      data-stemcells-plans-row=""
      data-tone={reading.tone}
      data-runs-out={reading.runsOutAt === null ? undefined : ""}
    >
      <span data-stemcells-plans-label="">{props.row.label}</span>
      <span data-stemcells-plans-when="">
        {windowWhen(reading, now, clock, duration, props.size === "page")}
      </span>
      <span data-stemcells-plans-used="">{used}%</span>
      <span data-stemcells-plans-bar="">
        {used > 0 ? (
          <i style={{ width: `${used}%`, background: inkOf(props.driver, reading.tone) }} />
        ) : null}
        {even !== null && even > 0 && even < 100 ? <u style={{ left: `${even}%` }} /> : null}
      </span>
    </li>
  );
}

/** A plan's Cell in its provider's colour, its name, and its tier when that isn't the name. */
function Name(props: { plan: PlanReading }) {
  const { plan } = props;
  return (
    <header data-stemcells-plans-name="" data-named={plan.named ? "true" : "false"}>
      <svg
        viewBox={`0 0 ${SIZE.width} ${SIZE.height}`}
        style={{ color: inkOf(String(plan.account.driver), "fine") }}
        fill="currentColor"
        aria-hidden
      >
        <path d={CELL} />
      </svg>
      <span>{plan.name}</span>
      {plan.account.plan && plan.account.plan !== plan.name ? (
        <small>{plan.account.plan}</small>
      ) : null}
    </header>
  );
}

/** What else stands on a plan: the Cells on it now, and on the card the resets it can spend. */
function Aside(props: { plan: PlanReading; size: BoardSize }) {
  const { plan } = props;
  const credits =
    props.size === "card" ? (plan.account.limits.resetCredits?.availableCount ?? 0) : 0;
  const words = [
    plan.working === 0 ? null : plan.working === 1 ? "1 Cell on it" : `${plan.working} Cells on it`,
    credits === 0 ? null : credits === 1 ? "1 reset to spend" : `${credits} resets to spend`,
  ].filter((each) => each !== null);
  return words.length === 0 ? null : <p data-stemcells-plans-aside="">{words.join(" · ")}</p>;
}

function Rows(props: { plan: PlanReading; clocks: Clocks; size: BoardSize }) {
  const driver = String(props.plan.account.driver);
  return (
    <ul>
      {props.plan.rows.map((row) => (
        <Row key={row.label} driver={driver} row={row} clocks={props.clocks} size={props.size} />
      ))}
    </ul>
  );
}

/**
 * Every plan, a block each: its provider's Cell, its name and tier, then a row per window (the
 * session, the week, each model's own week), each its percent and when it resets, or when the
 * pace runs it out first, over a bar with a tick where an even pace would be; then the Cells on
 * it. The ring's card and the Usage page draw the same blocks, the ring's plan first.
 */
export function PlanBoard(props: {
  plans: ReadonlyArray<PlanReading>;
  ring: PlanReading | null;
  clocks: Clocks;
  size: BoardSize;
  /** Anything under a plan's rows, as the page's reset credits. */
  renderUnder?: (plan: PlanReading) => ReactNode;
}) {
  return (
    <div data-stemcells-plans="" data-size={props.size}>
      {boardOrder(props.plans, props.ring).map((plan) => (
        <section key={plan.account.key} data-stemcells-plans-plan="">
          <Name plan={plan} />
          <Rows plan={plan} clocks={props.clocks} size={props.size} />
          <Aside plan={plan} size={props.size} />
          {props.renderUnder?.(plan) ?? null}
        </section>
      ))}
    </div>
  );
}

/** The plan you're on: the ring you clicked, grown, and where it stands. */
function Current(props: { plan: PlanReading; clocks: Clocks }) {
  const { plan, clocks } = props;
  const binding = bindingOf(plan);
  const figure = ringFigure(plan, clocks.now);
  const standing = standingOf(plan, clocks.now, clocks.clock, clocks.duration);
  const ink = inkOf(String(plan.account.driver), plan.tone);
  const used = plan.tone === "out" ? 100 : binding === null ? 0 : 100 - binding.left;
  return (
    <div data-stemcells-plans-current="">
      <span data-stemcells-plans-dial="" data-tone={plan.tone}>
        <svg viewBox="0 0 28 28" aria-hidden>
          <circle cx="14" cy="14" r={RADIUS} data-stemcells-plans-dial-track="" />
          {used > 0 ? (
            <circle
              cx="14"
              cy="14"
              r={RADIUS}
              style={{ stroke: ink }}
              strokeDasharray={`${(CIRCLE * used) / 100} ${CIRCLE}`}
              transform="rotate(-90 14 14)"
            />
          ) : null}
        </svg>
        <b>{figure === null ? "–" : plan.tone === "out" ? figure : `${figure}%`}</b>
      </span>
      <div>
        <Name plan={plan} />
        {standing === null ? null : (
          <p data-stemcells-plans-standing="" data-tone={standing.tone}>
            <span>{standing.lead}</span>
            {standing.detail === null ? null : <small>{standing.detail}</small>}
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * The ring's card, as the phone's sheet (`apps/mobile/src/stemcells/limits/PlanSheet.tsx`): the
 * plan you're on, then every other plan, the most room first, then the way to the Usage page.
 */
export function PlanCard(props: {
  plans: ReadonlyArray<PlanReading>;
  ring: PlanReading;
  clocks: Clocks;
  onUsage: () => void;
}) {
  const { plans, ring, clocks } = props;
  const rest = boardOrder(plans, ring).slice(1);
  return (
    <div data-stemcells-plans-card="">
      <h3>Limits</h3>
      <section data-stemcells-plans-plan="" data-current="">
        <Current plan={ring} clocks={clocks} />
        <Rows plan={ring} clocks={clocks} size="card" />
        <Aside plan={ring} size="card" />
      </section>
      {rest.length > 0 ? (
        <>
          <h4>{rest.length === 1 ? "Your other plan" : "Your other plans"}</h4>
          <PlanBoard plans={rest} ring={null} clocks={clocks} size="card" />
        </>
      ) : null}
      <button type="button" data-stemcells-plans-usage="" onClick={props.onUsage}>
        Usage
      </button>
      {plans.length > 1 && plans.some((plan) => !plan.named) ? (
        <p data-stemcells-plans-hint="">Name your plans in Settings › Providers.</p>
      ) : null}
    </div>
  );
}
