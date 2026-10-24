import type { ReactNode } from "react";

import { path, SIZE } from "../cell/look";
import { brandTokenOf } from "../tokens/providers";
import { headlineOf, type PlanReading, type PlanTone, type WindowReading } from "./plans";
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

interface Clocks {
  readonly now: number;
  /** "15.40", or "Tue 10.00" once it isn't today. */
  readonly clock: (at: number) => string;
  /** "2h 25m". */
  readonly duration: (ms: number) => string;
}

function resetOf(resetsAt: number, clocks: Clocks): string {
  const until = resetsAt - clocks.now;
  return until < DAY ? clocks.duration(until) : clocks.clock(resetsAt);
}

/** When it resets; when the pace runs it out first, that, and on the page the reset too. */
function whenOf(window: WindowReading, clocks: Clocks, size: BoardSize): string {
  if (window.resetsAt === null) return "";
  if (window.runsOutAt === null) return resetOf(window.resetsAt, clocks);
  const out = `out ${clocks.clock(window.runsOutAt)}`;
  return size === "page" ? `${out} · resets ${clocks.clock(window.resetsAt)}` : out;
}

function WindowCell(props: {
  driver: string;
  window: WindowReading | null;
  clocks: Clocks;
  size: BoardSize;
}) {
  const { window } = props;
  if (window === null) return <td data-stemcells-plans-none="" />;
  return (
    <td>
      <span data-stemcells-plans-window="" data-tone={window.tone}>
        <span data-stemcells-plans-bar="">
          <i style={{ width: `${window.left}%`, background: inkOf(props.driver, window.tone) }} />
          {window.evenLeft !== null ? <u style={{ left: `${window.evenLeft}%` }} /> : null}
        </span>
        <span data-stemcells-plans-left="">{window.left}%</span>
        <span data-stemcells-plans-when="">
          {whenOf(window, props.clocks, props.size)}
          {window.note ? <small> · {window.note}</small> : null}
        </span>
      </span>
    </td>
  );
}

/**
 * Every plan, a row each: its name, then its session (5h) and its week (7d),
 * each a bar of what is left with a tick where an even pace would be, the
 * percent, and when it resets, or when the pace runs it out first. The
 * rail's hover and the Usage page draw the same rows.
 */
export function PlanBoard(props: {
  plans: ReadonlyArray<PlanReading>;
  clocks: Clocks;
  size: BoardSize;
  /** Anything under a plan's row, as the page's reset credits. */
  renderUnder?: (plan: PlanReading) => ReactNode;
}) {
  const sessions = props.plans.some((plan) => plan.session !== null);
  return (
    <table data-stemcells-plans="" data-size={props.size}>
      <thead>
        <tr>
          <th>Plan</th>
          {sessions ? <th>5h</th> : null}
          <th>7d</th>
        </tr>
      </thead>
      <tbody>
        {props.plans.map((plan) => {
          const driver = String(plan.account.driver);
          const credits = plan.account.limits.resetCredits?.availableCount ?? 0;
          const under = props.renderUnder?.(plan) ?? null;
          return [
            <tr key={plan.account.key}>
              <td>
                <span data-stemcells-plans-name="" data-named={plan.named ? "true" : "false"}>
                  <svg
                    viewBox={`0 0 ${SIZE.width} ${SIZE.height}`}
                    style={{ color: inkOf(driver, "fine") }}
                    fill="currentColor"
                    aria-hidden
                  >
                    <path d={CELL} />
                  </svg>
                  <span>{plan.name}</span>
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
                </span>
              </td>
              {sessions ? (
                <WindowCell
                  driver={driver}
                  window={plan.session}
                  clocks={props.clocks}
                  size={props.size}
                />
              ) : null}
              <WindowCell
                driver={driver}
                window={plan.long}
                clocks={props.clocks}
                size={props.size}
              />
            </tr>,
            under === null ? null : (
              <tr key={`${plan.account.key}:under`} data-stemcells-plans-under="">
                <td colSpan={sessions ? 3 : 2}>{under}</td>
              </tr>
            ),
          ];
        })}
      </tbody>
    </table>
  );
}

/**
 * The rail's hover: when the ring's plan stops you, if it will before its
 * reset, then every plan.
 */
export function PlanCard(props: {
  plans: ReadonlyArray<PlanReading>;
  ring: PlanReading;
  clocks: Clocks;
}) {
  const { plans, ring, clocks } = props;
  const headline = headlineOf(ring, clocks.now, clocks.clock, clocks.duration);
  return (
    <div data-stemcells-plans-card="">
      {headline ? (
        <p data-stemcells-plans-headline="" data-tone={ring.tone}>
          {headline}
        </p>
      ) : null}
      <PlanBoard plans={plans} clocks={clocks} size="card" />
      {plans.length > 1 && plans.some((plan) => !plan.named) ? (
        <p data-stemcells-plans-hint="">Name your plans in Settings › Providers.</p>
      ) : null}
    </div>
  );
}
