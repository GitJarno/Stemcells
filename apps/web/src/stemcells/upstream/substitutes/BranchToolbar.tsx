// Replaces `components/BranchToolbar.tsx` (`plugin.ts`): in a Cell's pane, upstream's toolbar
// stands in panel layout, with its repositories checklist, in the menu under the ledge's "project
// · branch ⌄" (`composer/slot.ts`, `upstream/checkout.ts`); the branch shortcut opens that menu,
// and a draft's permissions stay under the box. Elsewhere it is upstream's.
/* oxlint-disable shadcn/no-unknown-classes -- Stemcells' classes live in its own stylesheet (composer-line.css), outside upstream's Tailwind entry. */
import {
  type ComponentProps,
  memo,
  use,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
} from "react";
import { createPortal } from "react-dom";

import {
  type BranchToolbarHandle,
  BranchToolbar as UpstreamBranchToolbar,
} from "../../../components/BranchToolbar";
import { ComposerSurface } from "../../../components/chat/ComposerSurface";
import { WorktreeRepositoriesControl } from "../../../components/WorktreeRepositoriesControl";
import { ComposerEnvSlot } from "../../composer/slot";
import { envOfferOf, useCheckoutKnownRepo, useToolbarRepositories } from "../checkout";

export * from "../../../components/BranchToolbar";

export const BranchToolbar = memo(function BranchToolbar({
  ref,
  ...props
}: ComponentProps<typeof UpstreamBranchToolbar>) {
  const slot = use(ComposerEnvSlot);
  const knownRepo = useCheckoutKnownRepo(props);
  const repositories = useToolbarRepositories(props);
  const ours = slot !== null && props.layout !== "panel";
  const offer = ours
    ? envOfferOf({
        showGitControls: props.showGitControls,
        showBranchControls: props.showBranchControls,
        knownRepo,
      })
    : null;
  // A folder of repositories has no branch of its own: the ledge names its repositories instead.
  const folder = offer === "repositories" ? repositories.label : null;
  const inner = useRef<BranchToolbarHandle>(null);
  const setOffer = slot?.setOffer;
  const setOpen = slot?.setOpen;
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Tell the ledge's slot what the toolbar offers while it does, and withdraw it on change or unmount.
  useLayoutEffect(() => {
    if (offer === null || setOffer === undefined) return;
    setOffer({ folder });
    return () => setOffer(null);
  }, [offer, folder, setOffer]);
  useImperativeHandle(ours ? ref : undefined, () => ({
    openBranchPicker: () => setOpen?.(true),
    usePreviousWorktree: () => inner.current?.usePreviousWorktree(),
  }));
  if (!ours) return <UpstreamBranchToolbar {...props} {...(ref ? { ref } : {})} />;
  // The strip keeps what the menu can't hold: a draft's permissions, which the
  // composer's controls stop naming once ChatView says the strip names them.
  const strip =
    props.trailing === undefined ? null : (
      <ComposerSurface.ContextStrip className="text-xs">
        {props.trailing}
      </ComposerSurface.ContextStrip>
    );
  if (offer === null || slot.element === null) return strip;
  return (
    <>
      {createPortal(
        <>
          <UpstreamBranchToolbar
            {...props}
            ref={inner}
            layout="panel"
            {...(offer === "repositories" ? { panelSection: "workspace" as const } : {})}
          />
          {/* Upstream's panel layout has no checklist; its composer strip draws this one. */}
          {repositories.choice && repositories.project !== null ? (
            <div className="composer-line-env-repositories">
              <WorktreeRepositoriesControl
                project={repositories.project}
                draftTarget={repositories.draftTarget}
                offersBaseBranch={offer === "repositories"}
              />
            </div>
          ) : null}
          {offer === "repositories" && repositories.startsNewWorktree ? (
            <p className="composer-line-env-base text-muted-foreground">
              {repositories.baseBranch === ""
                ? "Each repository starts from its own default branch"
                : `Repositories start from ${repositories.baseBranch} where they have it`}
            </p>
          ) : null}
        </>,
        slot.element,
      )}
      {strip}
    </>
  );
});
