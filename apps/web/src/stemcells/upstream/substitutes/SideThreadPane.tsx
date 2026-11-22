// Replaces `components/chat/SideThreadPane.tsx` (`plugin.ts`): a side chat or a subagent's thread
// is drawn in its Cell's panel, inside that Cell's pane, so it would read the pane's Cell and line
// slots: its composer line would name, settle and carry the Cell it sits beside, and take that
// line's stash and branch slots. It stands outside them; upstream's header over it names it.
import type { ComponentProps } from "react";

import UpstreamSideThreadPane from "../../../components/chat/SideThreadPane";
import { ComposerEnvSlot, ComposerRoofSlot, ComposerStashSlot } from "../../composer/slot";
import { PaneCellContext, PaneComposerContext } from "../../tabs/paneCell";

export * from "../../../components/chat/SideThreadPane";

export default function SideThreadPane(props: ComponentProps<typeof UpstreamSideThreadPane>) {
  return (
    <PaneCellContext value={null}>
      <PaneComposerContext value={null}>
        <ComposerRoofSlot value={null}>
          <ComposerEnvSlot value={null}>
            <ComposerStashSlot value={null}>
              <UpstreamSideThreadPane {...props} />
            </ComposerStashSlot>
          </ComposerEnvSlot>
        </ComposerRoofSlot>
      </PaneComposerContext>
    </PaneCellContext>
  );
}
