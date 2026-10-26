// Replaces `components/chat/ProviderInstanceIcon.tsx` for the usage page's files only
// (`SCOPED_SUBSTITUTES` in `plugin.ts`): where upstream draws a provider's logo there, the page
// draws a Cell's bare body in the provider's own colour (`tokens/providers.ts`), neutral if it
// has none. Everywhere else upstream's logos stay.
import { providerInstanceInitials } from "@t3tools/client-runtime/state/provider-instance-display";
import { memo, type ComponentProps } from "react";

import * as Upstream from "../../../components/chat/ProviderInstanceIcon";
import { cn } from "../../../lib/utils";
import { path, SIZE } from "../../cell/look";
import { brandTokenOf } from "../../tokens/providers";

export * from "../../../components/chat/ProviderInstanceIcon";

const colourOf = (driverKind: string): string => {
  const token = brandTokenOf(driverKind);
  return token === null ? "var(--sc-dim)" : `var(${token})`;
};

const CELL = path("awake");

export const ProviderInstanceIcon = memo(function ProviderInstanceIcon(
  props: ComponentProps<typeof Upstream.ProviderInstanceIcon>,
) {
  const indicatorBackground = props.indicatorBackground ?? "var(--card)";
  return (
    <span
      className={cn(
        "relative isolate z-30 inline-flex shrink-0 items-center justify-center overflow-visible",
        props.className,
      )}
    >
      <svg
        viewBox={`0 0 ${SIZE.width} ${SIZE.height}`}
        className={cn(
          "size-5 shrink-0",
          props.size === "compact" && "size-3.5",
          props.iconClassName,
        )}
        style={{ color: colourOf(props.driverKind) }}
        fill="currentColor"
        aria-hidden
      >
        <path d={CELL} />
      </svg>
      {props.showBadge && (props.badgeContent ?? "initials") === "initials" ? (
        // An account's initials, as upstream badges it: whose plan the row is.
        <span
          className="pointer-events-none absolute right-0 bottom-0 z-10 flex h-3.5 min-w-3.5 items-center justify-center rounded-full border bg-card px-0.5 text-4xs font-semibold leading-none text-muted-foreground shadow-sm"
          style={{ borderColor: indicatorBackground }}
          aria-hidden
        >
          {providerInstanceInitials(props.displayName)}
        </span>
      ) : null}
    </span>
  );
});
