import { useNavigate } from "@tanstack/react-router";

import { formatDuration, providerLook, useLimitPools } from "../upstream/rail";
import { useMinute } from "./clock";
import { bindingPlan, type PlanTone } from "./plans";
import { RailTip } from "./RailParts";

const RADIUS = 11;
const CIRCLE = 2 * Math.PI * RADIUS;

const TONE_INK: Readonly<Record<Exclude<PlanTone, "fine">, string>> = {
  low: "var(--sc-needs-you)",
  out: "var(--sc-error)",
};

/**
 * Plans and limits on the rail: a ring of what is left of the limit that
 * binds first, and its percent. The provider's colour while there is room,
 * amber when it runs short, red when it has run out. Reads the limits
 * upstream's Usage page shows, and opens it.
 */
export function PlanRing(props: { on: boolean }) {
  const now = useMinute();
  const plan = bindingPlan(useLimitPools(now));
  const navigate = useNavigate();
  if (plan === null) return null;

  const look = providerLook(plan.driver);
  const resets =
    plan.resetsAt !== null && plan.resetsAt > now
      ? `resets in ${formatDuration(plan.resetsAt - now)}`
      : null;
  const detail = [`${plan.left}% left`, resets].filter(Boolean).join(" · ");
  return (
    <RailTip
      title={`${look.name} · ${plan.label}`}
      detail={detail}
      trigger={
        <button
          type="button"
          aria-label={`${look.name} ${plan.label}: ${detail}`}
          aria-current={props.on ? "page" : undefined}
          data-stemcells-rail-plate=""
          data-on={props.on ? "true" : "false"}
          onClick={() => void navigate({ to: "/usage" })}
        >
          <span
            data-stemcells-gauge=""
            style={{ color: plan.tone === "fine" ? look.color : TONE_INK[plan.tone] }}
          >
            <svg viewBox="0 0 28 28" aria-hidden>
              <circle cx="14" cy="14" r={RADIUS} data-stemcells-gauge-track="" />
              <circle
                cx="14"
                cy="14"
                r={RADIUS}
                data-stemcells-gauge-fill=""
                strokeDasharray={`${(CIRCLE * plan.left) / 100} ${CIRCLE}`}
                transform="rotate(-90 14 14)"
              />
            </svg>
            <span data-stemcells-gauge-figure="">{plan.left}</span>
          </span>
        </button>
      }
    />
  );
}
