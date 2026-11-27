import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";

import { inkOf, PlanCard } from "../limits/PlanBoard";
import { bindingOf, ringFigure } from "../limits/plans";
import { usePlans } from "../limits/usePlans";
import {
  formatDuration,
  showLimitsOnUsage,
  useClockFormat,
  useLimitPresentations,
} from "../upstream/limits";
import { providerLook } from "../upstream/rail";
import { Popover, PopoverPopup, PopoverTrigger } from "../upstream/ui";
import { useMinute } from "./clock";

const RADIUS = 11.5;
const CIRCLE = 2 * Math.PI * RADIUS;

/**
 * The plan you're on, as a ring: filled to what its binding window (the one that stops it first)
 * has used, in the provider's colour, amber when the pace runs it out before the reset, red once
 * out; the percent inside, or once out, how long until it frees. A click opens every plan.
 */
export function PlanRing(props: { on: boolean }) {
  const now = useMinute();
  const { plans, ring } = usePlans(useLimitPresentations(), now);
  const clock = useClockFormat(now);
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const binding = ring === null ? null : bindingOf(ring);
  if (ring === null || binding === null) return null;

  const used = ring.tone === "out" ? 100 : 100 - binding.left;
  const figure = ringFigure(ring, now);
  const ink = inkOf(String(ring.account.driver), ring.tone);
  const label =
    ring.tone === "out"
      ? `${providerLook(ring.account.driver).name} · ${ring.name}: limited, frees in ${figure}`
      : `${providerLook(ring.account.driver).name} · ${ring.name}: ${used}% used`;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <button
            type="button"
            aria-label={label}
            aria-current={props.on ? "page" : undefined}
            data-stemcells-rail-plate=""
            data-on={props.on || open ? "true" : "false"}
          />
        }
      >
        <span data-stemcells-gauge="" data-tone={ring.tone}>
          <svg viewBox="0 0 28 28" aria-hidden>
            <circle cx="14" cy="14" r={RADIUS} data-stemcells-gauge-track="" />
            {used > 0 ? (
              <circle
                cx="14"
                cy="14"
                r={RADIUS}
                data-stemcells-gauge-fill=""
                style={{ stroke: ink }}
                strokeDasharray={`${(CIRCLE * used) / 100} ${CIRCLE}`}
                transform="rotate(-90 14 14)"
              />
            ) : null}
          </svg>
          <b
            data-stemcells-gauge-figure=""
            style={ring.tone === "fine" ? undefined : { color: ink }}
          >
            {figure}
          </b>
        </span>
      </PopoverTrigger>
      <PopoverPopup side="right" align="end" sideOffset={10} padding="none">
        <PlanCard
          plans={plans}
          ring={ring}
          clocks={{ now, clock, duration: formatDuration }}
          onUsage={() => {
            setOpen(false);
            showLimitsOnUsage();
            void navigate({ to: "/usage" });
          }}
        />
      </PopoverPopup>
    </Popover>
  );
}
