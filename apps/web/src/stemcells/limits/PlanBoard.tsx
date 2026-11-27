import type { ReactNode } from "react";

import { path, SIZE } from "../cell/look";
import { brandTokenOf } from "../tokens/providers";
import {
  boardOrder,
  headlineOf,
  type PlanReading,
  type PlanRow,
  type PlanTone,
  type WindowReading,
} from "./plans";
import "./limits.css";

const DAY = 24 * 60 * 60_000;
const CELL = path("awake");

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

/** When it resets; when the pace runs it out first, that, and on the page the reset too. */
function whenOf(window: WindowReading, clocks: Clocks, size: BoardSize): string {
  if (window.resetsAt === null) return "";
  const reset =
    window.resetsAt - clocks.now < DAY
      ? clocks.duration(window.resetsAt - clocks.now)
      : clocks.clock(window.resetsAt);
  if (window.runsOutAt === null) return reset;
  const out = `out ${clocks.clock(window.runsOutAt)}`;
  return size === "page" ? `${out} · resets ${reset}` : out;
}

function Row(props: { driver: string; row: PlanRow; clocks: Clocks; size: BoardSize }) {
  const { reading } = props.row;
  const used = 100 - reading.left;
  const even = reading.evenLeft === null ? null : 100 - reading.evenLeft;
  return (
    <li data-stemcells-plans-row="" data-tone={reading.tone}>
      <span data-stemcells-plans-label="">{props.row.label}</span>
      <span data-stemcells-plans-bar="">
        <i style={{ width: `${used}%`, background: inkOf(props.driver, reading.tone) }} />
        {even !== null ? <u style={{ left: `${even}%` }} /> : null}
      </span>
      <span data-stemcells-plans-used="">{used}%</span>
      <span data-stemcells-plans-when="">{whenOf(reading, props.clocks, props.size)}</span>
    </li>
  );
}

/**
 * Every plan, a block each: its provider's Cell, its name and tier, the Cells on it, then a row
 * per window (the session, the week, each model's own week), each a bar of what is used with a
 * tick where an even pace would be, the percent, and when it resets, or when the pace runs it out
 * first. The ring's card and the Usage page draw the same blocks, the ring's plan first.
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
      {boardOrder(props.plans, props.ring).map((plan) => {
        const driver = String(plan.account.driver);
        const credits = plan.account.limits.resetCredits?.availableCount ?? 0;
        return (
          <section key={plan.account.key} data-stemcells-plans-plan="">
            <header data-stemcells-plans-name="" data-named={plan.named ? "true" : "false"}>
              <svg
                viewBox={`0 0 ${SIZE.width} ${SIZE.height}`}
                style={{ color: inkOf(driver, "fine") }}
                fill="currentColor"
                aria-hidden
              >
                <path d={CELL} />
              </svg>
              <span>{plan.name}</span>
              {plan.account.plan && plan.account.plan !== plan.name ? (
                <small>{plan.account.plan}</small>
              ) : null}
              {plan.working > 0 ? (
                <span data-stemcells-plans-chip="">
                  {plan.working === 1 ? "1 Cell" : `${plan.working} Cells`}
                </span>
              ) : null}
              {credits > 0 && props.size === "card" ? (
                <span data-stemcells-plans-chip="">
                  {credits === 1 ? "1 reset" : `${credits} resets`}
                </span>
              ) : null}
            </header>
            <ul>
              {plan.rows.map((row) => (
                <Row
                  key={row.label}
                  driver={driver}
                  row={row}
                  clocks={props.clocks}
                  size={props.size}
                />
              ))}
            </ul>
            {props.renderUnder?.(plan) ?? null}
          </section>
        );
      })}
    </div>
  );
}

/**
 * The ring's card: when the ring's plan stops you, if it will before its reset, then every plan,
 * and a way to the Usage page.
 */
export function PlanCard(props: {
  plans: ReadonlyArray<PlanReading>;
  ring: PlanReading;
  clocks: Clocks;
  onUsage: () => void;
}) {
  const { plans, ring, clocks } = props;
  const headline = headlineOf(ring, clocks.now, clocks.clock, clocks.duration);
  return (
    <div data-stemcells-plans-card="">
      <div data-stemcells-plans-head="">
        <h3>Limits</h3>
        <button type="button" onClick={props.onUsage}>
          Usage
        </button>
      </div>
      {headline ? (
        <p data-stemcells-plans-headline="" data-tone={ring.tone}>
          {headline}
        </p>
      ) : null}
      <PlanBoard plans={plans} ring={ring} clocks={clocks} size="card" />
      {plans.length > 1 && plans.some((plan) => !plan.named) ? (
        <p data-stemcells-plans-hint="">Name your plans in Settings › Providers.</p>
      ) : null}
    </div>
  );
}
