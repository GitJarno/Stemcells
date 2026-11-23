/* oxlint-disable shadcn/no-unknown-classes -- Stemcells' classes live in its own stylesheet (composer-line.css), outside upstream's Tailwind entry. */
import { ChevronDownIcon, FolderGitIcon, GitBranchIcon } from "lucide-react";
import { type ComponentProps, useRef } from "react";

import { MiddleTruncate, Popover, PopoverPopup, PopoverTrigger } from "../upstream/ui";

type OpenChange = NonNullable<ComponentProps<typeof Popover>["onOpenChange"]>;

/**
 * Whether a press or a focus landed in a menu a control in `menu` opened. Such a menu is
 * portaled outside ours, so ours reads it as outside; closing then would leave a checklist that
 * stays open on a pick (upstream's repositories) anchored to nothing.
 */
function inOpenedLayer(details: Parameters<OpenChange>[1], menu: HTMLElement | null): boolean {
  if (menu === null) return false;
  if (details.reason !== "outside-press" && details.reason !== "focus-out") return false;
  const event: Event | undefined = details.event;
  const node = event instanceof FocusEvent ? event.relatedTarget : event?.target;
  if (!(node instanceof Node)) return false;
  return [...menu.querySelectorAll('[aria-expanded="true"][aria-controls]')].some((trigger) =>
    document.getElementById(trigger.getAttribute("aria-controls") ?? "")?.contains(node),
  );
}

/**
 * The "· branch" after the project on the Cell's ledge (`upstream/checkout.ts`), or a folder's
 * repositories. Where upstream offers its toolbar in the composer, a ⌄ opens a menu holding it
 * (`upstream/substitutes/BranchToolbar.tsx`), kept mounted so the toolbar keeps its state.
 */
export function LineEnv({
  host,
  ...props
}: {
  /** The branch, or what a folder of repositories names in its place. */
  label: string;
  repositories: boolean;
  /** Upstream's toolbar stands in the menu (`slot.ts`, `EnvSlot`). */
  offered: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The menu's element the toolbar is drawn into. */
  host: (element: HTMLElement | null) => void;
}) {
  const menu = useRef<HTMLDivElement | null>(null);
  const Mark = props.repositories ? FolderGitIcon : GitBranchIcon;
  const words = (
    <>
      <span aria-hidden className="composer-line-env-dot">
        ·
      </span>
      <Mark aria-hidden className="composer-line-branch-mark" />
      <span className="composer-line-branch-name">
        <MiddleTruncate value={props.label} />
      </span>
    </>
  );
  if (!props.offered) {
    return <span className="composer-line-env text-muted-foreground">{words}</span>;
  }
  return (
    <Popover
      open={props.open}
      onOpenChange={(open, details) => {
        if (!open && inOpenedLayer(details, menu.current)) return;
        props.onOpenChange(open);
      }}
    >
      <PopoverTrigger
        render={
          <button
            type="button"
            className="composer-line-env composer-line-act text-muted-foreground"
            aria-label={`Where it runs: ${props.label}`}
          />
        }
      >
        {words}
        <ChevronDownIcon aria-hidden />
      </PopoverTrigger>
      <PopoverPopup side="top" align="start" padding="compact" width="md" keepMounted>
        <div
          ref={(element) => {
            menu.current = element;
            host(element);
          }}
          data-stemcells-env-menu=""
        />
      </PopoverPopup>
    </Popover>
  );
}
