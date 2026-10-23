/**
 * Substitutes upstream's `components/sidebar/DesktopUpdateStatusIcon.tsx`
 * (`plugin.ts`). With an update ready, upstream's dot on its icon carries how
 * many changes the update brings, in upstream's own badge look (its
 * "downloaded" check). Every other state draws upstream's.
 */
import { DownloadIcon } from "lucide-react";
import type { ComponentProps } from "react";

import * as Upstream from "../../../components/sidebar/DesktopUpdateStatusIcon";
import { useDesktopUpdateState } from "../../../state/desktopUpdate";
import { changeCountLabel, updateChangeCount } from "../../updates/changes";

export * from "../../../components/sidebar/DesktopUpdateStatusIcon";

export function DesktopUpdateStatusIcon(
  props: ComponentProps<typeof Upstream.DesktopUpdateStatusIcon>,
) {
  const state = useDesktopUpdateState();
  const count = state ? updateChangeCount(state) : 0;
  if (props.status !== "available" || state === null || count === 0) {
    return <Upstream.DesktopUpdateStatusIcon {...props} />;
  }
  return (
    <span className="relative grid size-4 place-items-center">
      <DownloadIcon className="size-4" />
      <span
        aria-hidden="true"
        className="absolute -top-1.5 -right-2 grid h-3.5 min-w-3.5 place-items-center rounded-full bg-foreground px-0.5 text-3xs leading-none font-semibold text-background tabular-nums ring-2 ring-sidebar-control-surface"
      >
        {changeCountLabel(count, state.omittedReleaseCount > 0)}
      </span>
    </span>
  );
}
