// Replaces `components/BranchToolbar.tsx` (`plugin.ts`): in a Cell's pane, upstream's toolbar
// stands in panel layout in the menu under the ledge's "project · branch ⌄" (`composer/slot.ts`),
// once the checkout is known to be git (`upstream/checkout.ts`), never on a guess; the branch
// shortcut opens that menu. Outside a pane, and in the thread panel, it is upstream's.
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
import { ComposerEnvSlot } from "../../composer/slot";
import { useCheckoutKnownRepo } from "../checkout";

export * from "../../../components/BranchToolbar";

export const BranchToolbar = memo(function BranchToolbar({
  ref,
  ...props
}: ComponentProps<typeof UpstreamBranchToolbar>) {
  const slot = use(ComposerEnvSlot);
  const knownRepo = useCheckoutKnownRepo(props);
  const ours = slot !== null && props.layout !== "panel";
  const offered = ours && props.showGitControls && knownRepo;
  const inner = useRef<BranchToolbarHandle>(null);
  const setOffered = slot?.setOffered;
  const setOpen = slot?.setOpen;
  // oxlint-disable-next-line t3code/react-effect-budget -- Tell the ledge's slot the toolbar is offered while it is, and withdraw it on change or unmount.
  useLayoutEffect(() => {
    if (!offered || setOffered === undefined) return;
    setOffered(true);
    return () => setOffered(false);
  }, [offered, setOffered]);
  useImperativeHandle(ours ? ref : undefined, () => ({
    openBranchPicker: () => setOpen?.(true),
    usePreviousWorktree: () => inner.current?.usePreviousWorktree(),
  }));
  if (!ours) return <UpstreamBranchToolbar {...props} {...(ref ? { ref } : {})} />;
  if (!offered || slot.element === null) return null;
  return createPortal(
    <UpstreamBranchToolbar {...props} ref={inner} layout="panel" />,
    slot.element,
  );
});
