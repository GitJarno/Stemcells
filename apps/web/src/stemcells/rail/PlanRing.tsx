import { useNavigate } from "@tanstack/react-router";

import { inkOf, PlanCard } from "../limits/PlanBoard";
import type { PlanReading, WindowReading } from "../limits/plans";
import { usePlans } from "../limits/usePlans";
import { formatDuration, useClockFormat, useLimitPresentations } from "../upstream/limits";
import { providerLook } from "../upstream/rail";
import { PreviewCard, PreviewCardPopup, PreviewCardTrigger } from "../upstream/ui";
import { useMinute } from "./clock";

const OUTER = 11;
const INNER = 6.5;

function Arc(props: { radius: number; window: WindowReading; driver: string }) {
  const circle = 2 * Math.PI * props.radius;
  return (
    <>
      {/* Empty, the ring wears its tone: nothing left reads as the wall, not as no data. */}
      <circle
        cx="14"
        cy="14"
        r={props.radius}
        data-stemcells-gauge-track=""
        style={
          props.window.left <= 0 ? { stroke: inkOf(props.driver, props.window.tone) } : undefined
        }
      />
      {props.window.left > 0 ? (
        <circle
          cx="14"
          cy="14"
          r={props.radius}
          data-stemcells-gauge-fill=""
          style={{ stroke: inkOf(props.driver, props.window.tone) }}
          strokeDasharray={`${(circle * props.window.left) / 100} ${circle}`}
          transform="rotate(-90 14 14)"
        />
      ) : null}
    </>
  );
}

/** The plan's week outside and its session inside; a plan with one window, one ring. */
export function PlanRings(props: { plan: PlanReading }) {
  const { plan } = props;
  const driver = String(plan.account.driver);
  const outer = plan.long ?? plan.session;
  const inner = plan.long === null ? null : plan.session;
  return (
    <span data-stemcells-gauge="">
      <svg viewBox="0 0 28 28" aria-hidden>
        {outer ? <Arc radius={OUTER} window={outer} driver={driver} /> : null}
        {inner ? <Arc radius={INNER} window={inner} driver={driver} /> : null}
      </svg>
    </span>
  );
}

/**
 * Plans and limits on the rail: two rings for the plan you're on, its week
 * outside and its session (5h) inside, each filled to what is left, in the
 * provider's colour, amber when the pace runs it out before the reset, red
 * once out. Hovering lists every plan; a click opens the Usage page.
 */
export function PlanRing(props: { on: boolean }) {
  const now = useMinute();
  const { plans, ring } = usePlans(useLimitPresentations(), now);
  const clock = useClockFormat(now);
  const navigate = useNavigate();
  if (ring === null) return null;

  const label = [
    `${providerLook(ring.account.driver).name} · ${ring.name}`,
    ring.session ? `5h ${ring.session.left}% left` : null,
    ring.long ? `7d ${ring.long.left}% left` : null,
  ]
    .filter(Boolean)
    .join(", ");
  return (
    <PreviewCard>
      <PreviewCardTrigger
        delay={150}
        closeDelay={120}
        render={
          <button
            type="button"
            aria-label={label}
            aria-current={props.on ? "page" : undefined}
            data-stemcells-rail-plate=""
            data-on={props.on ? "true" : "false"}
            onClick={() => void navigate({ to: "/usage" })}
          />
        }
      >
        <PlanRings plan={ring} />
      </PreviewCardTrigger>
      <PreviewCardPopup side="right" align="end" sideOffset={10}>
        <PlanCard plans={plans} ring={ring} clocks={{ now, clock, duration: formatDuration }} />
      </PreviewCardPopup>
    </PreviewCard>
  );
}
