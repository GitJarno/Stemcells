// Replaces `components/chat/SideChatPane.tsx` (`plugin.ts`): a side chat is drawn in its Cell's
// panel, inside that Cell's pane, so it would read the pane's Cell and line slots: its composer
// line would name, settle and carry the Cell it sits beside, and take that line's stash and
// branch slots. It stands outside them; upstream's header over it names it.
import type { ComponentProps } from "react";

import UpstreamSideChatPane from "../../../components/chat/SideChatPane";
import { ComposerEnvSlot, ComposerRoofSlot, ComposerStashSlot } from "../../composer/slot";
import { PaneCellContext, PaneComposerContext } from "../../tabs/paneCell";

export * from "../../../components/chat/SideChatPane";

export default function SideChatPane(props: ComponentProps<typeof UpstreamSideChatPane>) {
  return (
    <PaneCellContext value={null}>
      <PaneComposerContext value={null}>
        <ComposerRoofSlot value={null}>
          <ComposerEnvSlot value={null}>
            <ComposerStashSlot value={null}>
              <UpstreamSideChatPane {...props} />
            </ComposerStashSlot>
          </ComposerEnvSlot>
        </ComposerRoofSlot>
      </PaneComposerContext>
    </PaneCellContext>
  );
}
