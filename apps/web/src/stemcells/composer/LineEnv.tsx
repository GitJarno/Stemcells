/* oxlint-disable shadcn/no-unknown-classes -- Stemcells' classes live in its own stylesheet (composer-line.css), outside upstream's Tailwind entry. */
import { ChevronDownIcon, GitBranchIcon } from "lucide-react";

import { MiddleTruncate, Popover, PopoverPopup, PopoverTrigger } from "../upstream/ui";

/**
 * The "· branch" after the project on the Cell's ledge: the branch the chat
 * is on (`upstream/checkout.ts`). Where upstream offers its branch toolbar
 * in the composer (a draft, or a chat whose person keeps it after it
 * starts), the branch carries a ⌄ and opens a menu holding that toolbar, in
 * upstream's panel layout (`upstream/substitutes/BranchToolbar.tsx`). The
 * menu stays mounted while closed, so the toolbar keeps its state as it
 * did under the box.
 */
export function LineEnv({
  host,
  ...props
}: {
  branch: string;
  /** Upstream's toolbar stands in the menu (`slot.ts`, `EnvSlot`). */
  offered: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The menu's element the toolbar is drawn into. */
  host: (element: HTMLElement | null) => void;
}) {
  const words = (
    <>
      <span aria-hidden className="composer-line-env-dot">
        ·
      </span>
      <GitBranchIcon aria-hidden className="composer-line-branch-mark" />
      <span className="composer-line-branch-name">
        <MiddleTruncate value={props.branch} />
      </span>
    </>
  );
  if (!props.offered) {
    return <span className="composer-line-env text-muted-foreground">{words}</span>;
  }
  return (
    <Popover open={props.open} onOpenChange={props.onOpenChange}>
      <PopoverTrigger
        render={
          <button
            type="button"
            className="composer-line-env composer-line-act text-muted-foreground"
            aria-label={`Where it runs: ${props.branch}`}
          />
        }
      >
        {words}
        <ChevronDownIcon aria-hidden />
      </PopoverTrigger>
      <PopoverPopup side="top" align="start" padding="compact" width="md" keepMounted>
        <div ref={host} />
      </PopoverPopup>
    </Popover>
  );
}
